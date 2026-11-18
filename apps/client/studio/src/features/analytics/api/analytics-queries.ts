import { assertNever } from '@kit/result';
import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { VideoAnalytics } from '@vp/api-contracts';
import type { AnalyticsRange, AnalyticsScope } from '../types';

export type RangeAnalytics = Pick<
  VideoAnalytics,
  'range' | 'from' | 'to' | 'timeline' | 'hourly' | 'rangeViews' | 'rangeWatchSeconds' | 'previous'
>;

export type AudienceRange = Exclude<AnalyticsRange, 'lifetime'>;

/** The split is kept for 90 days at most, so a lifetime range asks for the longest one. */
export const audienceRangeOf = (range: AnalyticsRange): AudienceRange =>
  range === 'lifetime' ? '90d' : range;

const analyticsKeys = {
  all: ['studio', 'analytics'] as const,
  channel: (range: AnalyticsRange) => [...analyticsKeys.all, 'channel', range] as const,
  video: (videoId: string, range: AnalyticsRange) =>
    [...analyticsKeys.all, 'video', videoId, range] as const,
  audience: (videoId: string, range: AudienceRange) =>
    [...analyticsKeys.all, 'audience', videoId, range] as const,
  benchmark: (videoId: string) => [...analyticsKeys.all, 'benchmark', videoId] as const,
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

export function videoAudienceQueryOptions(api: ApiClient, videoId: string, range: AnalyticsRange) {
  const audienceRange = audienceRangeOf(range);
  return queryOptions({
    queryKey: analyticsKeys.audience(videoId, audienceRange),
    queryFn: ({ signal }) =>
      api.analytics.getVideoAudience({
        params: { id: videoId },
        query: { range: audienceRange },
        signal,
      }),
  });
}

export function videoBenchmarkQueryOptions(api: ApiClient, videoId: string) {
  return queryOptions({
    queryKey: analyticsKeys.benchmark(videoId),
    queryFn: ({ signal }) => api.analytics.getVideoBenchmark({ params: { id: videoId }, signal }),
  });
}
