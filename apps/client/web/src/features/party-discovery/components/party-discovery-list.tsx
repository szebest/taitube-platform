import { EmptyLibraryIllustration, EmptyState, SectionError } from '@kit/components';
import { Button, Callout } from '@kit/ui';
import { useNavigate } from '@tanstack/react-router';
import type { PartyDiscoveryFilters } from '@vp/queries';
import { FeedSentinel } from '#app/components/feed/feed-sentinel';
import { useOnlineStatus } from '#app/hooks/use-online-status';
import { useT } from '#app/lib/messages';
import { useNow } from '../hooks/use-now';
import { usePartyDiscovery } from '../hooks/use-party-discovery';
import { useStartParty } from '../hooks/use-start-party';
import { isNarrowed } from '../utils/discovery-search';
import { PartyDiscoveryCard } from './party-discovery-card';

const GRID =
  'm-0 grid list-none grid-cols-[repeat(auto-fill,minmax(var(--layout-card-min),1fr))] gap-x-grid-x gap-y-grid-y p-0';

export interface PartyDiscoveryListProps {
  filters: PartyDiscoveryFilters;
}

/** The grid of one filtered view and every state around it: empty, empty with filters, offline, paused, more to load. */
export function PartyDiscoveryList({ filters }: PartyDiscoveryListProps) {
  const { tOr } = useT();
  const online = useOnlineStatus();
  const now = useNow(1000);
  const navigate = useNavigate();
  const {
    items,
    ended,
    freshCount,
    showFresh,
    live,
    hasNextPage,
    isFetching,
    isError,
    fetchNextPage,
  } = usePartyDiscovery(filters);

  if (items.length === 0) {
    return isNarrowed(filters) ? (
      <EmptyState.Root size="page">
        <EmptyState.Illustration>
          <EmptyLibraryIllustration />
        </EmptyState.Illustration>
        <EmptyState.Title asChild>
          <h2>{tOr('party.discoveryEmptyFiltered', {}, '')}</h2>
        </EmptyState.Title>
        <EmptyState.Action asChild>
          <Button
            variant="soft"
            onClick={() => navigate({ to: '/parties', search: {}, replace: true })}
          >
            {tOr('party.discoveryClearFilters', {}, '')}
          </Button>
        </EmptyState.Action>
      </EmptyState.Root>
    ) : (
      <NoPartiesYet />
    );
  }

  return (
    <div className="flex flex-col gap-stack">
      {!online && (
        <Callout.Root role="status">
          <Callout.Icon />
          <Callout.Body>{tOr('party.discoveryOffline', {}, '')}</Callout.Body>
        </Callout.Root>
      )}
      {online && !live && (
        <p role="status" className="m-0 text-caption text-fg-muted">
          {tOr('party.discoveryLivePaused', {}, '')}
        </p>
      )}
      <div className="relative">
        {freshCount > 0 && (
          <div className="pointer-events-none sticky top-stack z-lift flex justify-center">
            <Button
              size="sm"
              className="pointer-events-auto absolute shadow-raised"
              onClick={() => void showFresh()}
            >
              {tOr('party.discoveryNewParties', { count: freshCount }, '')}
            </Button>
          </div>
        )}
        <ul aria-label={tOr('party.discoveryGrid', {}, '')} className={GRID}>
          {items.map((card) => (
            <li key={card.id}>
              <PartyDiscoveryCard card={card} ended={ended.has(card.id)} now={now} />
            </li>
          ))}
        </ul>
      </div>
      {isError && (
        <SectionError.Root role="alert" retrying={isFetching} onRetry={() => fetchNextPage()}>
          <SectionError.Message>
            {tOr('party.discoveryLoadMoreFailed', {}, '')}
          </SectionError.Message>
        </SectionError.Root>
      )}
      {hasNextPage && !isFetching && !isError && (
        <FeedSentinel onNear={() => fetchNextPage({ cancelRefetch: false })} />
      )}
    </div>
  );
}

function NoPartiesYet() {
  const { tOr } = useT();
  const { start, isPending, isError } = useStartParty();

  return (
    <EmptyState.Root size="page">
      <EmptyState.Illustration>
        <EmptyLibraryIllustration />
      </EmptyState.Illustration>
      <EmptyState.Title asChild>
        <h2>{tOr('party.discoveryEmpty', {}, '')}</h2>
      </EmptyState.Title>
      {isError && (
        <EmptyState.Description role="alert">
          {tOr('party.discoveryStartFailed', {}, '')}
        </EmptyState.Description>
      )}
      <EmptyState.Action asChild>
        <Button onClick={start} disabled={isPending}>
          {tOr('party.startAParty', {}, '')}
        </Button>
      </EmptyState.Action>
    </EmptyState.Root>
  );
}
