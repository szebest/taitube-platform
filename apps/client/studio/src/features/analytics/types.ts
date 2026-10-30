import type { AnalyticsRange } from '@vp/domain';

export type { AnalyticsRange };

export const KPI_METRICS = ['views', 'watch-time', 'average-view-duration'] as const;

export type KpiMetric = (typeof KPI_METRICS)[number];

export type AnalyticsScope = { kind: 'channel' } | { kind: 'video'; videoId: string };
