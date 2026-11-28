import { type InfiniteData, useQueryClient, useSuspenseInfiniteQuery } from '@tanstack/react-query';
import type { WatchPartyCardView, WatchPartyDiscoveryEvent } from '@vp/api-contracts';
import {
  type PartyDiscoveryFilters,
  partyDiscoveryItems,
  useApi,
  useWatchPartyDiscoveryEvents,
  watchPartyDiscoveryQueryOptions,
} from '@vp/queries';
import { useState } from 'react';
import { matchesFilters } from '../utils/party-card-model';

type Pages = InfiniteData<{ items: WatchPartyCardView[]; nextCursor: string | null }, unknown>;

function mapCards(
  data: Pages | undefined,
  change: (card: WatchPartyCardView) => WatchPartyCardView
): Pages | undefined {
  return (
    data && {
      ...data,
      pages: data.pages.map((page) => ({ ...page, items: page.items.map(change) })),
    }
  );
}

/**
 * The rooms of one filtered view, kept current by discovery's stream while the page is visible: a
 * count or a change patches the card in the cache, a closed room turns "ended" without leaving its
 * place, and a room that opens and matches waits in `fresh` until the viewer asks for it, so the
 * grid never shifts under them.
 */
export function usePartyDiscovery(filters: PartyDiscoveryFilters) {
  const api = useApi();
  const queryClient = useQueryClient();
  const options = watchPartyDiscoveryQueryOptions(api, filters);
  const { data, hasNextPage, isFetching, isError, fetchNextPage, refetch } =
    useSuspenseInfiniteQuery(options);
  const [live, setLive] = useState(true);
  const [ended, setEnded] = useState<ReadonlySet<string>>(new Set());
  const [fresh, setFresh] = useState<ReadonlyMap<string, WatchPartyCardView>>(new Map());
  const items = partyDiscoveryItems(data.pages);

  const patch = (change: (card: WatchPartyCardView) => WatchPartyCardView) =>
    queryClient.setQueryData(options.queryKey, (current) => mapCards(current, change));

  const hear = (event: WatchPartyDiscoveryEvent) => {
    switch (event.type) {
      case 'party.counts': {
        const counts = new Map(
          event.payload.counts.map(({ id, presentCount }) => [id, presentCount])
        );
        patch((card) => {
          const presentCount = counts.get(card.id);
          return presentCount === undefined ? card : { ...card, presentCount };
        });
        return;
      }
      case 'party.updated': {
        const { card: updated } = event.payload;
        patch((card) => (card.id === updated.id ? updated : card));
        return;
      }
      case 'party.closed': {
        const { id } = event.payload;
        if (items.some((card) => card.id === id)) setEnded((current) => new Set(current).add(id));
        setFresh((current) => {
          const next = new Map(current);
          next.delete(id);
          return next;
        });
        return;
      }
      case 'party.opened': {
        const { card } = event.payload;
        const listed = items.some(({ id }) => id === card.id);
        if (!listed && matchesFilters(card, filters, Date.now())) {
          setFresh((current) => new Map(current).set(card.id, card));
        }
        return;
      }
    }
  };

  useWatchPartyDiscoveryEvents(hear, setLive);

  const showFresh = async () => {
    await refetch();
    setFresh(new Map());
    setEnded(new Set());
  };

  return {
    items,
    ended,
    freshCount: fresh.size,
    showFresh,
    live,
    hasNextPage,
    isFetching,
    isError,
    fetchNextPage,
    serverNow: data.pages[0]?.items[0]?.serverNow,
  };
}
