import { keysetPaging } from '@kit/query';
import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ListWatchPartiesQuery, WatchPartyCardView } from '@vp/api-contracts';

export const watchPartyKeys = {
  all: ['watch-parties'] as const,
  preview: (roomId: string, invite?: string) =>
    [...watchPartyKeys.all, 'preview', roomId, invite ?? null] as const,
  mine: () => [...watchPartyKeys.all, 'mine'] as const,
  discovery: (filters: PartyDiscoveryFilters) =>
    [...watchPartyKeys.all, 'discovery', filters] as const,
};

/** What `/parties` asks for, every field at its default when not narrowed. */
export type PartyDiscoveryFilters = Omit<ListWatchPartiesQuery, 'cursor' | 'limit'>;

type DiscoveryRequest = Parameters<ApiClient['watchPartyDiscovery']['listWatchParties']>[0];

const NARROWING_FLAGS = ['space', 'followed', 'creator'] as const;

/** Sends only what narrows the list, so the default view is the bare path and its cache key is stable. */
function discoveryRequest(
  filters: PartyDiscoveryFilters,
  cursor: string | undefined
): NonNullable<DiscoveryRequest>['query'] {
  const { q, status, category, language, access, size, kind, sort } = filters;
  return {
    ...(q ? { q } : {}),
    ...(status === 'all' ? {} : { status }),
    ...(category ? { category } : {}),
    ...(language ? { language } : {}),
    ...(access === 'any' ? {} : { access }),
    ...(size === 'any' ? {} : { size }),
    ...(kind === 'any' ? {} : { kind }),
    ...(sort === 'members' ? {} : { sort }),
    ...Object.fromEntries(
      NARROWING_FLAGS.filter((flag) => filters[flag]).map((flag) => [flag, 'true'])
    ),
    ...(cursor ? { cursor } : {}),
  };
}

/** The rooms of every page read, a repeated id once: counts move between keyset pages. */
export function partyDiscoveryItems(pages: readonly { items: WatchPartyCardView[] }[]) {
  const seen = new Set<string>();
  return pages.flatMap((page) => page.items).filter(({ id }) => !seen.has(id) && seen.add(id));
}

export function watchPartyDiscoveryQueryOptions(api: ApiClient, filters: PartyDiscoveryFilters) {
  return infiniteQueryOptions({
    queryKey: watchPartyKeys.discovery(filters),
    queryFn: ({ pageParam }) =>
      api.watchPartyDiscovery.listWatchParties({ query: discoveryRequest(filters, pageParam) }),
    ...keysetPaging,
  });
}

/** A room as a visitor sees it before they have a seat; a member's live view is the socket's. */
export function watchPartyPreviewQueryOptions(api: ApiClient, roomId: string, invite?: string) {
  return queryOptions({
    queryKey: watchPartyKeys.preview(roomId, invite),
    queryFn: () =>
      api.watchParties.getWatchParty({
        params: { id: roomId },
        query: invite ? { invite } : undefined,
      }),
  });
}

/** @public */
export function myWatchPartiesQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: watchPartyKeys.mine(),
    queryFn: () => api.watchParties.listMyWatchParties({}),
  });
}
