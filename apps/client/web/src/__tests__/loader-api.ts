import {
  type EndpointContract,
  getAccount,
  getChannel,
  getFeed,
  getSubscriptionFeed,
  getVideo,
  listCategories,
  listMySubscriptions,
  search,
} from '@vp/api-contracts';
import {
  type EndpointResolver,
  account,
  channel,
  mockEndpoint,
  video,
  videoSummary,
} from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';

const FEED = { items: [videoSummary({ title: 'Feed video' })], nextCursor: null, total: 1 };

const SEARCH = {
  items: [{ type: 'video' as const, data: videoSummary({ title: 'Search hit' }) }],
  nextCursor: null,
  tookMs: 1,
  total: 1,
  fuzzyFallback: false,
};

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
    recorded(search, () => HttpResponse.json(SEARCH)),
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
