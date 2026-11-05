import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

/** One replay request covers this much of the broadcast. */
export const REPLAY_WINDOW_MS = 30_000;

const LIVE_NOW_LIMIT = 24;

export const liveKeys = {
  all: ['live'] as const,
  now: () => [...liveKeys.all, 'now'] as const,
  detail: (liveStreamId: string) => [...liveKeys.all, 'detail', liveStreamId] as const,
  replay: (liveStreamId: string, window: number) =>
    [...liveKeys.all, 'replay', liveStreamId, window] as const,
};

export function liveNowQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: liveKeys.now(),
    queryFn: () => api.live.listLiveStreams({ query: { limit: LIVE_NOW_LIMIT } }),
  });
}

export function liveStreamQueryOptions(api: ApiClient, liveStreamId: string) {
  return queryOptions({
    queryKey: liveKeys.detail(liveStreamId),
    queryFn: () => api.live.getLiveStream({ params: { id: liveStreamId } }),
  });
}

/** The chat lines of replay window `window`; a recording's chat never changes, so it never goes stale. */
export function chatReplayQueryOptions(api: ApiClient, liveStreamId: string, window: number) {
  return queryOptions({
    queryKey: liveKeys.replay(liveStreamId, window),
    queryFn: () =>
      api.liveChat.getLiveChatReplay({
        params: { id: liveStreamId },
        query: { fromMs: window * REPLAY_WINDOW_MS, toMs: (window + 1) * REPLAY_WINDOW_MS },
      }),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
