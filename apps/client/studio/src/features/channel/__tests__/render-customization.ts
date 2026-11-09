import { screen } from '@testing-library/react';
import { getMyChannel, getMySpotlight, setMySpotlight, updateMyChannel } from '@vp/api-contracts';
import { platformOfUrl } from '@vp/domain';
import { account, channel, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { featuredApi } from '#app/__tests__/featured-api.fixture';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

/** `/customization` for a signed-in creator whose channel is `own`, with `handlers` answering the API first. */
export async function renderCustomization(
  own: Parameters<typeof channel>[0] = {},
  handlers: HttpHandler[] = []
) {
  const rendered = await renderRoute(getRouter, '/customization', {
    handlers: [
      signInBrowser(account({ channel: channel(own) })),
      ...handlers,
      mockEndpoint(getMyChannel, () => HttpResponse.json(channel(own))),
      mockEndpoint(getMySpotlight, () =>
        HttpResponse.json({ trailerVideoId: null, returningVideoId: null, localizations: [] })
      ),
      mockEndpoint(setMySpotlight, async ({ request }) => HttpResponse.json(await request.json())),
      ...featuredApi().handlers,
    ],
  });
  await screen.findByRole('form', { name: 'Links' });
  await screen.findByRole('form', { name: 'Trailer and welcome back' });
  return rendered;
}

/** The API accepting every change: the channel as it was, with the changes applied. */
export function savesChannel(own: Parameters<typeof channel>[0] = {}, bodies: unknown[] = []) {
  return mockEndpoint(updateMyChannel, async ({ request }) => {
    const changes = await request.json();
    bodies.push(changes);
    const { links, ...rest } = changes;
    return HttpResponse.json(
      channel({
        ...own,
        ...rest,
        ...(links && {
          links: links.map((link) => ({ ...link, platform: platformOfUrl(link.url) })),
        }),
      })
    );
  });
}
