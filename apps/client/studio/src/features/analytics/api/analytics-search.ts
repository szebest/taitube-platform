import { ANALYTICS_RANGES } from '@vp/domain';
import { z } from 'zod';

import type { AnalyticsRange } from '../types';

const DEFAULT_ANALYTICS_RANGE = '30d' satisfies AnalyticsRange;

export const AnalyticsSearchSchema = z.object({
  range: z
    .unknown()
    .optional()
    .transform(
      (range) => ANALYTICS_RANGES.find((known) => known === range) ?? DEFAULT_ANALYTICS_RANGE
    ),
});
