import { createFileRoute } from '@tanstack/react-router';

import { analyticsQueryOptions } from '#app/features/analytics/api/analytics-queries';
import { AnalyticsSearchSchema } from '#app/features/analytics/api/analytics-search';
import { AnalyticsPage } from '#app/features/analytics/components/analytics-page';

export const Route = createFileRoute('/_authed/analytics')({
  validateSearch: AnalyticsSearchSchema,
  loaderDeps: ({ search: { range } }) => ({ range }),
  loader: ({ context: { queryClient, api }, deps: { range } }) =>
    queryClient.prefetchQuery(analyticsQueryOptions(api, { kind: 'channel' }, range)),
  component: AnalyticsPage,
});
