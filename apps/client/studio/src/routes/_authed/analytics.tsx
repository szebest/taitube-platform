import { createFileRoute } from '@tanstack/react-router';
import { prefetched } from '@vp/queries';
import {
  AnalyticsPage,
  analyticsQueryOptions,
  AnalyticsSearchSchema,
} from '#app/features/analytics';

export const Route = createFileRoute('/_authed/analytics')({
  validateSearch: AnalyticsSearchSchema,
  loaderDeps: ({ search: { range } }) => ({ range }),
  loader: ({ context: { queryClient, api }, deps: { range } }) =>
    prefetched(queryClient.query(analyticsQueryOptions(api, { kind: 'channel' }, range))),
  component: AnalyticsPage,
});
