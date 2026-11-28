import { PageHeader } from '@kit/components';
import { Skeleton } from '@kit/ui';
import { getRouteApi } from '@tanstack/react-router';
import { SectionBoundary } from '@vp/queries';
import { Suspense } from 'react';
import { useT } from '#app/lib/messages';
import { filtersOf } from '../utils/discovery-search';
import { PartyDiscoveryFilters } from './party-discovery-filters';
import { PartyDiscoveryList } from './party-discovery-list';

const route = getRouteApi('/parties/');

/** `/parties`: the open public rooms, filtered by the URL. */
export function PartyDiscoveryPage() {
  const search = route.useSearch();
  const { tOr } = useT();
  const filters = filtersOf(search);
  const view = JSON.stringify(filters);

  return (
    <section className="flex flex-col gap-section">
      <PageHeader.Root>
        <PageHeader.Title asChild>
          <h1>{tOr('party.title', {}, '')}</h1>
        </PageHeader.Title>
      </PageHeader.Root>
      <PartyDiscoveryFilters filters={filters} />
      <SectionBoundary
        message={tOr('party.discoveryLoadFailed', {}, '')}
        resetKey={view}
        layout="block"
      >
        <Suspense key={view} fallback={<PartyDiscoveryPageSkeleton />}>
          <PartyDiscoveryList key={view} filters={filters} />
        </Suspense>
      </SectionBoundary>
    </section>
  );
}

export function PartyDiscoveryPageSkeleton() {
  return (
    <ul
      aria-hidden="true"
      className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(var(--layout-card-min),1fr))] gap-x-grid-x gap-y-grid-y p-0"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index}>
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="mt-stack h-5 w-3/4" />
          <Skeleton className="mt-inline h-4 w-1/2" />
        </li>
      ))}
    </ul>
  );
}
