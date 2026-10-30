import { screen } from '@testing-library/react';
import {
  listSearchHistory,
  removeSearchHistoryEntry,
  type SearchResponse,
  type SearchResultItem,
  type SearchSuggestion,
  search,
  searchSuggestions,
} from '@vp/api-contracts';
import { CHANNEL_ID, mockEndpoint, videoSummary } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

import type { ChannelHit, PlaylistHit, VideoHit } from '../search-hits';

const PLAYLIST_ID = '0190c3a0-5e1d-7000-8000-00000000d001';
const SECOND_VIDEO_ID = '0190c3a0-5e1d-7000-8000-00000000a002';

export const channelHit = (overrides: Partial<ChannelHit> = {}): SearchResultItem => ({
  type: 'channel',
  data: {
    id: CHANNEL_ID,
    handle: 'reactconf',
    displayName: 'React Conf',
    avatarUrl: null,
    bio: 'Talks about React and more',
    subscriberCount: 4200,
    ...overrides,
  },
});

export const videoResult = (overrides: Partial<VideoHit> = {}): SearchResultItem => ({
  type: 'video',
  data: videoSummary({
    id: SECOND_VIDEO_ID,
    title: 'React in practice',
    description: 'Learn React the practical way',
    durationMs: 612_000,
    viewsCount: 1500,
    ...overrides,
  }),
});

export const playlistResult = (overrides: Partial<PlaylistHit> = {}): SearchResultItem => ({
  type: 'playlist',
  data: {
    id: PLAYLIST_ID,
    title: 'React course',
    description: '',
    thumbnailUrl: null,
    owner: null,
    videoCount: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  },
});

export const page = (
  items: SearchResultItem[],
  overrides: Partial<SearchResponse> = {}
): SearchResponse => ({
  items,
  nextCursor: null,
  tookMs: 1,
  total: items.length,
  fuzzyFallback: false,
  ...overrides,
});

/** Answers `/v1/search` with `reply`, and records the query string of every request in `asked`. */
export function searchReply(
  reply: (params: URLSearchParams) => SearchResponse,
  asked: string[] = []
) {
  return mockEndpoint(search, ({ request }) => {
    const { searchParams } = new URL(request.url);
    asked.push(searchParams.toString());
    return HttpResponse.json(reply(searchParams));
  });
}

export function suggestionsReply(items: SearchSuggestion[], asked: string[] = []) {
  return mockEndpoint(searchSuggestions, ({ request }) => {
    asked.push(new URL(request.url).searchParams.get('q') ?? '');
    return HttpResponse.json({ items });
  });
}

export function historyReply(entries: { id: string; query: string }[]) {
  return mockEndpoint(listSearchHistory, () =>
    HttpResponse.json({
      items: entries.map((entry) => ({ ...entry, searchedAt: '2026-01-02T00:00:00.000Z' })),
      nextCursor: null,
    })
  );
}

export function removeHistoryReply(removed: string[]) {
  return mockEndpoint(removeSearchHistoryEntry, ({ params }) => {
    removed.push(String(params.id));
    return new HttpResponse(null, { status: 204 });
  });
}

/** The search suite's one way to open a route: the real router, the loader fixtures behind `handlers`. */
export async function renderSearch(url: string, handlers: HttpHandler[] = [], signedIn = false) {
  const extra = signedIn ? [signInBrowser()] : [];
  return renderRoute(getRouter, url, { handlers: [...handlers, ...extra, ...loaderApi()] });
}

export async function openPalette(url = '/', handlers: HttpHandler[] = [], signedIn = false) {
  const rendered = await renderSearch(url, [...handlers, suggestionsReply([])], signedIn);
  await rendered.user.keyboard('/');
  return { ...rendered, field: await screen.findByRole('combobox') };
}
