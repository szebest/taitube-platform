import { type ChannelPageView, getChannelPage, previewChannelPage } from '@vp/api-contracts';
import { CHANNEL_ID, mockEndpoint } from '@vp/web-testing';
import { type HttpHandler, HttpResponse } from 'msw/http';

type PageTab = ChannelPageView['tab'];
type TabSummary = ChannelPageView['tabs'][number];
type Section = PageTab['sections'][number];

export const SERIES_VIDEO = '0190a1b2-0000-7000-8000-0000000000a1';
export const HEADER_IMAGE = '0190a1b2-0000-7000-8000-0000000000b1';
export const BACKGROUND_IMAGE = '0190a1b2-0000-7000-8000-0000000000b2';
export const INLINE_IMAGE = '0190a1b2-0000-7000-8000-0000000000b3';

export const IMAGE_URLS = {
  w640: 'http://localhost:9000/cdn/page-image/640.webp',
  w1280: 'http://localhost:9000/cdn/page-image/1280.webp',
};

export const tabSummary = (overrides: Partial<TabSummary> = {}): TabSummary => ({
  id: 'home',
  kind: 'home',
  title: 'Home',
  slug: 'home',
  icon: null,
  ...overrides,
});

export const PRESENTATION: Section['presentation'] = {
  title: { default: 'Season one' },
  subtitle: null,
  background: null,
  accent: null,
  density: 'comfortable',
  show: { duration: true, views: true, date: false },
};

export const videoItem = (title: string) => ({
  kind: 'video' as const,
  id: SERIES_VIDEO,
  title,
  thumbnailUrl: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  format: 'standard' as const,
  durationMs: 125_000,
  viewsCount: 1200,
  likesCount: 10,
});

export const contentSection = (overrides: Partial<Section> = {}): Section =>
  ({
    kind: 'content',
    id: 'series',
    presentation: PRESENTATION,
    layout: { type: 'grid', columns: 3 },
    seeAll: null,
    items: [videoItem('The pilot')],
    ...overrides,
  }) as Section;

export function channelPageView(
  tab: Partial<PageTab> = {},
  overrides: Partial<ChannelPageView> = {}
): ChannelPageView {
  const summary = tabSummary(tab);
  return {
    channelId: CHANNEL_ID,
    revision: 1,
    seed: 'visit-1',
    landing: summary.slug,
    tabs: [summary],
    tab: { ...summary, description: null, header: null, sections: [], ...tab },
    images: {},
    ...overrides,
  };
}

/** Answers the public page and the preview of the channel, and writes the query of each request it answers into `asked`. */
export function channelPageApi(
  reply: (query: URLSearchParams, authorization: string | null) => ChannelPageView,
  asked: string[] = []
): HttpHandler[] {
  const answer = (request: Request) => {
    const { pathname, searchParams } = new URL(request.url);
    asked.push(`${pathname}?${searchParams}`);
    return reply(searchParams, request.headers.get('authorization'));
  };
  return [
    mockEndpoint(getChannelPage, ({ request }) => HttpResponse.json(answer(request))),
    mockEndpoint(previewChannelPage, ({ request }) => HttpResponse.json(answer(request))),
  ];
}
