import {
  type EndpointContract,
  getAccount,
  getChannel,
  getFeed,
  getSubscriptionFeed,
  getVideo,
  listCategories,
  listMySubscriptions,
} from '@vp/api-contracts';
import { type HttpHandler, HttpResponse } from 'msw/http';

import { account, channel, video, videoSummary } from './fixtures';
import { type EndpointResolver, mockEndpoint } from './msw/mock-endpoint';

const FEED = { items: [videoSummary({ title: 'Feed video' })], nextCursor: null, total: 1 };

/**
 * Answers the signed-in account and every endpoint a route loader reads, each with one fixture, and writes the path of every
 * request it answers into `answered`, so a spec can count what a navigation asked for.
 */
export function loaderApi(answered: string[] = []): HttpHandler[] {
  function recorded<T extends EndpointContract>(contract: T, reply: EndpointResolver<T>) {
    return mockEndpoint(contract, (info) => {
      answered.push(new URL(info.request.url).pathname);
      return reply(info);
    });
  }

  return [
    recorded(getAccount, () => HttpResponse.json(account())),
    recorded(getFeed, () => HttpResponse.json(FEED)),
    recorded(getSubscriptionFeed, () => HttpResponse.json(FEED)),
    recorded(listCategories, () => HttpResponse.json([])),
    recorded(listMySubscriptions, () => HttpResponse.json({ items: [], nextCursor: null })),
    recorded(getChannel, ({ params }) =>
      HttpResponse.json(channel({ id: String(params.idOrHandle) }))
    ),
    recorded(getVideo, ({ params }) =>
      HttpResponse.json(video({ id: String(params.id), title: 'Launch day' }))
    ),
  ];
}
