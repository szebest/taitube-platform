import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApi } from '@vp/queries';

import { analyticsQueryOptions } from '../api/analytics-queries';
import type { AnalyticsRange, AnalyticsScope } from '../types';

export function useAnalytics(scope: AnalyticsScope, range: AnalyticsRange) {
  const api = useApi();

  return useQuery({
    ...analyticsQueryOptions(api, scope, range),
    placeholderData: keepPreviousData,
  });
}
