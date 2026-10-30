import { isSubscribedToChannel, listVideos } from '@vp/api-contracts';
import { account, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

export const CHANNEL = `/channel/${account().channel.id}`;

export function renderShell(url: string, signedIn: boolean) {
  const handlers = signedIn
    ? [
        signInBrowser(),
        mockEndpoint(listVideos, () => HttpResponse.json({ items: [], nextCursor: null })),
        mockEndpoint(isSubscribedToChannel, ({ params }) =>
          HttpResponse.json({ channelId: String(params.id), subscribed: false })
        ),
        ...loaderApi(),
      ]
    : loaderApi();
  return renderRoute(getRouter, url, { handlers });
}
