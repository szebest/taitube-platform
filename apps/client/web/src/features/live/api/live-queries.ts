import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { LiveChatMessageView } from '@vp/api-contracts';

/** One replay request covers this much of the broadcast. */
export const REPLAY_WINDOW_MS = 30_000;

const LIVE_NOW_LIMIT = 24;

/** The most lines one replay page holds: the API's `LIVE_CHAT.replayLimit`. */
const REPLAY_PAGE_LINES = 500;

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

/**
 * The chat lines of replay window `window`, every page of it: a full page means more follow from
 * its last offset, which the next page repeats, so lines already read are skipped by id.
 */
async function replayWindow(
  api: ApiClient,
  liveStreamId: string,
  window: number
): Promise<LiveChatMessageView[]> {
  const toMs = (window + 1) * REPLAY_WINDOW_MS;
  const lines: LiveChatMessageView[] = [];
  const seen = new Set<string>();
  let fromMs = window * REPLAY_WINDOW_MS;

  while (fromMs < toMs) {
    const { items } = await api.liveChat.getLiveChatReplay({
      params: { id: liveStreamId },
      query: { fromMs, toMs },
    });
    const fresh = items.filter((line) => !seen.has(line.id));
    for (const line of fresh) seen.add(line.id);
    lines.push(...fresh);

    const lastOffset = items.at(-1)?.offsetMs;
    if (items.length < REPLAY_PAGE_LINES || lastOffset === undefined) return lines;
    fromMs = fresh.length === 0 ? lastOffset + 1 : lastOffset;
  }
  return lines;
}

/** The chat lines of replay window `window`; a recording's chat never changes, so it never goes stale. */
export function chatReplayQueryOptions(api: ApiClient, liveStreamId: string, window: number) {
  return queryOptions({
    queryKey: liveKeys.replay(liveStreamId, window),
    queryFn: () => replayWindow(api, liveStreamId, window),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
