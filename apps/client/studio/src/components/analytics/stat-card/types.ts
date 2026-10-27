import type { AvatarSize, BadgeTone } from '@vp/ui';
import type { ChartSeries } from '../chart-frame';

export type StatCardSize = Extract<AvatarSize, 'md' | 'lg'>;
export type StatCardState = 'ready' | 'loading' | 'error' | 'empty';
export type StatCardTrend = 'up' | 'down' | 'flat';
export type StatCardDeltaTone = Extract<BadgeTone, 'success' | 'danger' | 'neutral'>;
export type StatCardSeries = ChartSeries;

export type StatCardStatus =
  | { state?: Exclude<StatCardState, 'error'>; onRetry?: never }
  | { state: Extract<StatCardState, 'error'>; onRetry: () => void };
