import type { FormatValue } from '@vp/intl';

import type { StatCardTrend } from '#app/components/analytics/stat-card';

/** `percent` for a figure that is never negative, `count` for one that can cross zero. */
export type KpiChangeUnit = 'percent' | 'count';

export interface KpiChange {
  trend: StatCardTrend;
  value: FormatValue;
}

const SIGNED = { signDisplay: 'exceptZero' } as const;

function trendOf(difference: number): StatCardTrend {
  if (difference > 0) {
    return 'up';
  }
  if (difference < 0) {
    return 'down';
  }
  return 'flat';
}

/** The change from the previous period; none without one, or as a percentage of nothing. */
export function kpiChange(
  current: number,
  previous: number | null,
  unit: KpiChangeUnit
): KpiChange | null {
  if (previous === null || (unit === 'percent' && previous === 0)) {
    return null;
  }

  const difference = current - previous;
  const value: FormatValue =
    unit === 'percent'
      ? { type: 'percent', value: (difference / previous) * 100, options: SIGNED }
      : { type: 'number', value: difference, options: SIGNED };

  return { trend: trendOf(difference), value };
}
