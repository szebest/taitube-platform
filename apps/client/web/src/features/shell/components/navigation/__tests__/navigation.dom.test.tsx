import { screen, waitFor, within } from '@testing-library/react';
import { AUTH_TOKEN_LOCAL_STORAGE_KEY } from '@vp/queries';
import { account } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { STUDIO_URL } from '#app/config';
import { getRouter } from '#app/router';

const CHANNEL = `/channel/${account().channel.id}`;

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
      token: null,
      side: [
        ['Home', '/'],
        ['Trending', '/trending'],
      ],
      bottom: [
        ['Home', '/'],
        ['Trending', '/trending'],
      ],
    },
    {
      viewer: 'a signed-in viewer',
      token: 'signed-in',
      side: [
        ['Home', '/'],
        ['Subscriptions', '/subscriptions/videos'],
        ['Trending', '/trending'],
        ['Your channel', CHANNEL],
        ['Your videos', STUDIO_URL],
      ],
      bottom: [
        ['Home', '/'],
        ['Subscriptions', '/subscriptions/videos'],
        ['Trending', '/trending'],
        ['Your channel', CHANNEL],
      ],
    },
  ])('offers $viewer the sidebar and bottom bar links', async ({ token, side, bottom }) => {
    if (token) {
      window.localStorage.setItem(AUTH_TOKEN_LOCAL_STORAGE_KEY, token);
    }

    await renderRoute(getRouter, '/', { handlers: loaderApi() });

    await waitFor(() => {
      const [sideNav, bottomNav] = screen.getAllByRole('navigation', { name: 'Main' });
      expect(linksIn(sideNav as HTMLElement)).toEqual(side);
      expect(linksIn(bottomNav as HTMLElement)).toEqual(bottom);
    });
  });
});
