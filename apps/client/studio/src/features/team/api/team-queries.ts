import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import type { ChannelAuditAction } from '@vp/domain';
import { KEYSET_PAGE_SIZE, keysetPaging } from '@vp/queries';

export type AuditFilters = { actorUserId?: string; action?: ChannelAuditAction };

export const teamKeys = {
  all: ['team'] as const,
  members: () => [...teamKeys.all, 'members'] as const,
  memberships: () => [...teamKeys.all, 'memberships'] as const,
  audit: (filters: AuditFilters) => [...teamKeys.all, 'audit', filters] as const,
  lookup: (handle: string) => [...teamKeys.all, 'lookup', handle] as const,
};

/** The members and pending invites of the acting channel. */
export function teamQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: teamKeys.members(),
    queryFn: () => api.channelTeam.getChannelTeam(),
  });
}

/** The channels the caller works on besides their own, for the switcher and the permission rules. */
export function membershipsQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: teamKeys.memberships(),
    queryFn: () => api.channelTeam.listMyMemberships(),
    staleTime: 30_000,
  });
}

/** The acting channel's audit log, newest first, keyset-paged and narrowed by `filters`. */
export function auditQueryOptions(api: ApiClient, filters: AuditFilters) {
  return infiniteQueryOptions({
    queryKey: teamKeys.audit(filters),
    queryFn: ({ pageParam }) =>
      api.channelTeam.listChannelAudit({
        query: { ...filters, limit: KEYSET_PAGE_SIZE, cursor: pageParam },
      }),
    ...keysetPaging,
  });
}

/** The channel behind a handle, for the invite dialog; asked only once there is a handle to ask for. */
export function channelLookupQueryOptions(api: ApiClient, handle: string) {
  return queryOptions({
    queryKey: teamKeys.lookup(handle),
    queryFn: () => api.channels.getChannel({ params: { idOrHandle: handle } }),
    enabled: handle.length > 0,
    retry: false,
  });
}
