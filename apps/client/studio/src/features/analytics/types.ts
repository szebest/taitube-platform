import type { AnalyticsRange } from '@vp/domain';

export type { AnalyticsRange };

export type KpiMetric = 'views' | 'watch-time' | 'average-view-duration';

export type ViewsGranularity = 'day' | 'hour';

export type AnalyticsScope = { kind: 'channel' } | { kind: 'video'; videoId: string };
