import { screen, waitFor, within } from '@testing-library/react';
import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from '@vp/queries';
import { account } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { STUDIO_URL } from '#app/config';
import { getRouter } from '#app/router';

const CHANNEL = `/channel/${account().channel.id}`;

function renderShell(url: string, token: string | null) {
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_LOCAL_STORAGE_KEY, token);
  }
  return renderRoute(getRouter, url, { handlers: loaderApi() });
}

function linksIn(nav: HTMLElement) {
  return within(nav)
    .getAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')]);
}

afterEach(() => window.localStorage.clear());

describe('apps/client/web: shell navigation', () => {
  it.each([
    {
      viewer: 'a guest',
      url: '/feed/trending',
      token: null,
      active: 'Trending',
      side: [
        ['Home', '/'],
        ['Trending', '/feed/trending'],
      ],
      bottom: [
        ['Home', '/'],
        ['Trending', '/feed/trending'],
      ],
    },
    {
      viewer: 'a signed-in viewer',
      url: '/',
      token: 'signed-in',
      active: 'Home',
      side: [
        ['Home', '/'],
        ['Subscriptions', '/subscriptions/videos'],
        ['Trending', '/feed/trending'],
        ['Your channel', CHANNEL],
        ['Your videos', STUDIO_URL],
      ],
      bottom: [
        ['Home', '/'],
        ['Subscriptions', '/subscriptions/videos'],
        ['Trending', '/feed/trending'],
        ['Your channel', CHANNEL],
      ],
    },
  ])(
    'offers $viewer the sidebar and bottom bar links, $active marked current',
    async ({ url, token, active, side, bottom }) => {
      await renderShell(url, token);

      await waitFor(() => {
        const navs = screen.getAllByRole('navigation', { name: 'Main' });
        expect(navs.map(linksIn)).toEqual([side, bottom]);
        for (const nav of navs) {
          expect(within(nav).getByRole('link', { name: active })).toHaveAttribute(
            'aria-current',
            'page'
          );
        }
      });
    }
  );
});
