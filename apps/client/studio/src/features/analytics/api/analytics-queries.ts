import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { VideoAnalytics } from '@vp/api-contracts';
import { assertNever } from '@vp/result';
import type { AnalyticsRange, AnalyticsScope } from '../types';

export type RangeAnalytics = Pick<
  VideoAnalytics,
  'range' | 'from' | 'to' | 'timeline' | 'hourly' | 'rangeViews' | 'rangeWatchSeconds' | 'previous'
>;

const analyticsKeys = {
  all: ['studio', 'analytics'] as const,
  channel: (range: AnalyticsRange) => [...analyticsKeys.all, 'channel', range] as const,
  video: (videoId: string, range: AnalyticsRange) =>
    [...analyticsKeys.all, 'video', videoId, range] as const,
};

const fetchChannelAnalytics = (api: ApiClient, range: AnalyticsRange, signal: AbortSignal) =>
  api.analytics.getChannelAnalytics({ query: { range }, signal });

function fetchAnalytics(
  api: ApiClient,
  scope: AnalyticsScope,
  range: AnalyticsRange,
  signal: AbortSignal
): Promise<RangeAnalytics> {
  switch (scope.kind) {
    case 'channel':
      return fetchChannelAnalytics(api, range, signal);
    case 'video':
      return api.analytics.getVideoAnalytics({
        params: { id: scope.videoId },
        query: { range },
        signal,
      });
    default:
      return assertNever(scope, 'analytics scope');
  }
}

export function analyticsQueryOptions(
  api: ApiClient,
  scope: AnalyticsScope,
  range: AnalyticsRange
) {
  return queryOptions({
    queryKey:
      scope.kind === 'channel'
        ? analyticsKeys.channel(range)
        : analyticsKeys.video(scope.videoId, range),
    queryFn: ({ signal }) => fetchAnalytics(api, scope, range, signal),
  });
}

/** The channel's figures in full, net subscribers included, from the cache entry the channel scope fills. */
export function channelAnalyticsQueryOptions(api: ApiClient, range: AnalyticsRange) {
  return queryOptions({
    queryKey: analyticsKeys.channel(range),
    queryFn: ({ signal }) => fetchChannelAnalytics(api, range, signal),
  });
}
