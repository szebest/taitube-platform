import { createFileRoute } from '@tanstack/react-router';
import {
  AnalyticsPage,
  analyticsQueryOptions,
  AnalyticsSearchSchema,
} from '#app/features/analytics';

export const Route = createFileRoute('/_authed/analytics')({
  validateSearch: AnalyticsSearchSchema,
  loaderDeps: ({ search: { range } }) => ({ range }),
  loader: ({ context: { queryClient, api }, deps: { range } }) =>
    queryClient.prefetchQuery(analyticsQueryOptions(api, { kind: 'channel' }, range)),
  component: AnalyticsPage,
});
