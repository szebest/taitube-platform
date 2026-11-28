import { createFileRoute } from '@tanstack/react-router';
import { watchPartyDiscoveryQueryOptions } from '@vp/queries';
import {
  DiscoverySearchSchema,
  filtersOf,
  PartyDiscoveryPage,
  PartyDiscoveryPageSkeleton,
} from '#app/features/party-discovery';
import { WEB_URL } from '#app/lib/config';
import { headWords } from '#app/lib/seo/head-words';
import { partiesHead } from '#app/lib/seo/parties-head';

export const Route = createFileRoute('/parties/')({
  validateSearch: DiscoverySearchSchema,
  loaderDeps: ({ search }) => ({ filters: filtersOf(search) }),
  loader: async ({ cause, context: { queryClient, api }, deps: { filters } }) => {
    const options = {
      ...watchPartyDiscoveryQueryOptions(api, filters),
      staleTime: 'static' as const,
    };
    if (cause === 'stay') {
      void queryClient.prefetchInfiniteQuery(options);
      return;
    }

    await queryClient.infiniteQuery(options);
  },
  head: ({ match }) => partiesHead(WEB_URL, headWords(match.context.locales.snapshot())),
  pendingComponent: PartyDiscoveryPageSkeleton,
  component: PartyDiscoveryPage,
});
