import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ChannelAnalytics } from '@vp/api-contracts';
import { assertNever } from '@vp/result';

import type { AnalyticsRange, AnalyticsScope } from '../types';

export type RangeAnalytics = Pick<
  ChannelAnalytics,
  'range' | 'from' | 'to' | 'timeline' | 'rangeViews'
>;

const analyticsKeys = {
  all: ['studio', 'analytics'] as const,
  channel: (range: AnalyticsRange) => [...analyticsKeys.all, 'channel', range] as const,
  video: (videoId: string, range: AnalyticsRange) =>
    [...analyticsKeys.all, 'video', videoId, range] as const,
};

function fetchAnalytics(
  api: ApiClient,
  scope: AnalyticsScope,
  range: AnalyticsRange,
  signal: AbortSignal
): Promise<RangeAnalytics> {
  switch (scope.kind) {
    case 'channel':
      return api.analytics.getChannelAnalytics({ query: { range }, signal });
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
