import {
  type EndpointContract,
  getAccount,
  getChannel,
  getChannelFeatured,
  getCurrentPick,
  getFeed,
  getHome,
  getPreferences,
  getRelatedVideos,
  getShorts,
  getSubscriptionFeed,
  getUnreadNotificationCount,
  getVideo,
  isSubscribedToChannel,
  listCategories,
  listMyMemberships,
  listCaptions,
  listChannelVideos,
  listLiveStreams,
  listMySubscriptions,
  listVideos,
  search,
} from '@vp/api-contracts';
import {
  account,
  channel,
  type EndpointResolver,
  fallbackPick,
  mockEndpoint,
  VIDEO_ID,
  video,
  videoSummary,
} from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';
import { preferencesView } from './preferences-fixtures';
import { SHORTS } from './short-fixtures';

const RELATED_ID = '0190c3a0-5e1d-7000-8000-00000000a009';

const WATCHED = {
  durationMs: 200_000,
  viewer: { progressSeconds: 100, watchedAt: '2026-01-02T00:00:00.000Z' },
};

const FEED = {
  items: [videoSummary({ title: 'Feed video', ...WATCHED })],
  nextCursor: null,
  total: 1,
};

const HOME = {
  shelves: [
    {
      kind: 'continue' as const,
      items: [
        {
          ...videoSummary({ title: 'Feed video', ...WATCHED }),
          reason: { kind: 'continue' as const },
        },
      ],
    },
    {
      kind: 'because-watched' as const,
      subject: { kind: 'video' as const, id: VIDEO_ID, name: 'Lisbon at night' },
      items: [
        {
          ...videoSummary({ id: RELATED_ID, title: 'Tram ride' }),
          reason: { kind: 'shared-tags' as const, subjectId: VIDEO_ID },
        },
      ],
    },
    {
      kind: 'trending' as const,
      items: [
        {
          ...videoSummary({ id: RELATED_ID, title: 'Tram ride' }),
          reason: { kind: 'trending' as const },
        },
      ],
    },
  ],
};

const RELATED = {
  items: [
    {
      ...videoSummary({ id: RELATED_ID, title: 'Tram ride' }),
      reason: { kind: 'co-watched' as const, subjectId: VIDEO_ID },
    },
  ],
};

const SHORTS_FEED = { items: SHORTS, nextCursor: null, total: SHORTS.length };

const SEARCH = {
  items: [{ type: 'video' as const, data: videoSummary({ title: 'Search hit' }) }],
  nextCursor: null,
  tookMs: 1,
  total: 1,
  fuzzyFallback: false,
};

/**
 * Answers the signed-in account, its preferences, its unread count and every endpoint a route loader reads, each with one fixture, and writes the path of every
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
    recorded(listMyMemberships, () => HttpResponse.json({ items: [] })),
    recorded(getFeed, () => HttpResponse.json(FEED)),
    recorded(getPreferences, () => HttpResponse.json(preferencesView())),
    recorded(getUnreadNotificationCount, () => HttpResponse.json({ unreadCount: 0 })),
    recorded(getHome, () => HttpResponse.json(HOME)),
    recorded(getCurrentPick, () => HttpResponse.json(fallbackPick())),
    recorded(getRelatedVideos, () => HttpResponse.json(RELATED)),
    recorded(getSubscriptionFeed, () => HttpResponse.json(FEED)),
    recorded(getShorts, () => HttpResponse.json(SHORTS_FEED)),
    recorded(listLiveStreams, () => HttpResponse.json({ items: [] })),
    recorded(search, () => HttpResponse.json(SEARCH)),
    recorded(listVideos, () => HttpResponse.json(FEED)),
    recorded(isSubscribedToChannel, ({ params }) =>
      HttpResponse.json({ channelId: String(params.id), subscribed: false })
    ),
    recorded(listCategories, () => HttpResponse.json([])),
    recorded(listCaptions, () => HttpResponse.json({ tracks: [] })),
    recorded(listMySubscriptions, () => HttpResponse.json({ items: [], nextCursor: null })),
    recorded(listChannelVideos, () => HttpResponse.json(FEED)),
    recorded(getChannel, ({ params }) =>
      HttpResponse.json(channel({ id: String(params.idOrHandle) }))
    ),
    recorded(getChannelFeatured, () =>
      HttpResponse.json({ source: 'popular' as const, items: FEED.items })
    ),
    recorded(getVideo, ({ params }) =>
      HttpResponse.json(video({ id: String(params.id), title: 'Launch day' }))
    ),
  ];
}
