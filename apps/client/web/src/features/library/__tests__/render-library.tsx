import {
  type AuthoredCommentView,
  type ContractResult,
  clearSearchHistory,
  clearWatchHistory,
  deleteComment,
  getPlaylist,
  listChannelVideos,
  listLikedVideos,
  listMyComments,
  listMyPlaylists,
  listSearchHistory,
  listWatchHistory,
  removeSearchHistoryEntry,
  removeWatchHistoryEntry,
  type SearchHistoryItemView,
  setReaction,
  type VideoSummary,
  type WatchHistoryItemView,
} from '@vp/api-contracts';
import { mockEndpoint } from '@vp/web-testing';
import { renderRoute } from '@vp/web-testing/dom';
import { type HttpHandler, HttpResponse } from 'msw/http';

import { loaderApi } from '#app/__tests__/loader-api';
import { signInBrowser } from '#app/__tests__/providers';
import { holds, preferencesView } from '#app/features/settings/__tests__/preferences-fixtures';
import { getRouter } from '#app/router';

import { NOW, watchLaterPlaylist } from './library-fixtures';

export interface LibraryApi {
  history?: WatchHistoryItemView[];
  searches?: SearchHistoryItemView[];
  liked?: VideoSummary[];
  comments?: AuthoredCommentView[];
  playlists?: ContractResult<typeof listMyPlaylists>['items'];
  /** The videos on the Watch Later list. */
  watchLater?: VideoSummary[];
  /** The videos of the viewer's own channel. */
  uploads?: VideoSummary[];
  /** How many rows an answer holds; the rest come with the cursor. */
  pageSize?: number;
  historyPaused?: boolean;
  /** `METHOD /path` of every request the handlers answer, in order. */
  calls?: string[];
}

const NO_CONTENT = () => new HttpResponse<null>(null, { status: 204 });

/** Keyset pages over `rows`: the cursor is the offset of the next page. */
function pageOf<T>(rows: T[], cursor: string | null, size: number) {
  const start = cursor === null ? 0 : Number(cursor);
  const end = start + size;
  return { items: rows.slice(start, end), nextCursor: end < rows.length ? String(end) : null };
}

/** The viewer's activity endpoints over fixed rows, each removal answered with `204`. */
export function libraryApi({
  history = [],
  searches = [],
  liked = [],
  comments = [],
  playlists = [],
  watchLater = [],
  uploads,
  pageSize = 30,
  historyPaused = false,
  calls = [],
}: LibraryApi = {}): HttpHandler[] {
  const asked = <T extends Parameters<typeof mockEndpoint>[0]>(
    contract: T,
    reply: Parameters<typeof mockEndpoint<T>>[1]
  ) =>
    mockEndpoint(contract, (info) => {
      calls.push(`${info.request.method} ${new URL(info.request.url).pathname}`);
      return reply(info);
    });
  const cursorOf = ({ request }: { request: Request }) =>
    new URL(request.url).searchParams.get('cursor');

  return [
    holds(
      preferencesView({
        privacy: { historyPaused, playlistVisibility: 'private', subscriptionsVisible: false },
      })
    ),
    asked(listWatchHistory, (info) => HttpResponse.json(pageOf(history, cursorOf(info), pageSize))),
    asked(listSearchHistory, (info) =>
      HttpResponse.json(pageOf(searches, cursorOf(info), pageSize))
    ),
    asked(listLikedVideos, (info) => HttpResponse.json(pageOf(liked, cursorOf(info), pageSize))),
    asked(listMyComments, (info) => HttpResponse.json(pageOf(comments, cursorOf(info), pageSize))),
    asked(listMyPlaylists, () => HttpResponse.json({ items: playlists })),
    asked(getPlaylist, ({ params }) =>
      HttpResponse.json(watchLaterPlaylist(String(params.id), watchLater))
    ),
    ...(uploads
      ? [
          asked(listChannelVideos, () =>
            HttpResponse.json({ items: uploads, nextCursor: null, total: uploads.length })
          ),
        ]
      : []),
    asked(removeWatchHistoryEntry, NO_CONTENT),
    asked(clearWatchHistory, NO_CONTENT),
    asked(removeSearchHistoryEntry, NO_CONTENT),
    asked(clearSearchHistory, NO_CONTENT),
    asked(deleteComment, NO_CONTENT),
    asked(setReaction, ({ params }) =>
      HttpResponse.json({
        videoId: String(params.id),
        reaction: null,
        likesCount: 0,
        dislikesCount: 0,
      })
    ),
  ];
}

/** `url` of a signed-in viewer, over the library endpoints and the loader fixtures; `handlers` win. */
export async function renderLibrary(
  url: string,
  { handlers = [], ...api }: LibraryApi & { handlers?: HttpHandler[] } = {}
) {
  return renderRoute(getRouter, url, {
    handlers: [...handlers, signInBrowser(), ...libraryApi(api), ...loaderApi()],
  });
}

/** Holds the clock at `NOW` for the describe block it is called in, so "today" and "8 months ago" stay put. */
export function useLibraryClock(): void {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
}
