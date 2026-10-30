import { type Channel, updateMyChannel } from '@vp/api-contracts';
import { account, channel, mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

/** `/customization` for a signed-in creator whose channel is `own`, with `handlers` answering the API first. */
export function renderCustomization(own: Partial<Channel> = {}, handlers: HttpHandler[] = []) {
  return renderRoute(getRouter, '/customization', {
    handlers: [signInBrowser(account({ channel: channel(own) })), ...handlers],
  });
}

/** The API accepting every change: the channel as it was, with the changes applied. */
export function savesChannel(own: Partial<Channel> = {}, bodies: unknown[] = []) {
  return mockEndpoint(updateMyChannel, async ({ request }) => {
    const changes = await request.json();
    bodies.push(changes);
    return HttpResponse.json(channel({ ...own, ...changes }));
  });
}
