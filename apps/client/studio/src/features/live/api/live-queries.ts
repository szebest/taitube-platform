import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';

/** @internal */
export const LIVE_POLL_MS = 10_000;

export const liveKeys = {
  all: ['live'] as const,
  mine: () => [...liveKeys.all, 'mine'] as const,
  overlay: (token: string) => [...liveKeys.all, 'overlay', token] as const,
};

/** Idempotent: the idle or live stream comes back, and the first call mints its key. An idle one is polled, to notice the encoder connecting. */
export function myLiveStreamQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: liveKeys.mine(),
    queryFn: ({ signal }) => api.creatorLive.openMyLiveStream({ signal }),
    refetchInterval: ({ state }) => (state.data?.status === 'IDLE' ? LIVE_POLL_MS : false),
  });
}

export function liveOverlayQueryOptions(api: ApiClient, token: string) {
  return queryOptions({
    queryKey: liveKeys.overlay(token),
    queryFn: ({ signal }) => api.live.getLiveOverlay({ params: { token }, signal }),
    refetchInterval: LIVE_POLL_MS,
  });
}
