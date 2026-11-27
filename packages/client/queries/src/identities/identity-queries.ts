import { queryOptions } from '@tanstack/react-query';
import type { ApiClient } from '@vp/api-client';
import { glanceAccounts } from '../account-glance';
import { listAccounts } from '../session-functions';

/** The other accounts are asked again this often while the switcher is open. */
const GLANCE_INTERVAL_MS = 60_000;

export const identityKeys = {
  all: ['identities'] as const,
  mine: () => [...identityKeys.all, 'mine'] as const,
  accounts: () => [...identityKeys.all, 'accounts'] as const,
  glance: (slot: number) => [...identityKeys.all, 'glance', slot] as const,
};

/** The active account, its owned channels and the teams it works on: what the switcher lists for it. */
export function identitiesQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: identityKeys.mine(),
    queryFn: () => api.myChannels.listMyIdentities(),
  });
}

/** The browser's slot list from `vp.accounts`, each row's session checked against its cookie. */
export function accountsListQueryOptions() {
  return queryOptions({ queryKey: identityKeys.accounts(), queryFn: () => listAccounts() });
}

/** What waits on every other signed-in account, one call for all of them, while `open`. */
export function accountGlanceQueryOptions(slot: number, open: boolean) {
  return queryOptions({
    queryKey: identityKeys.glance(slot),
    queryFn: () => glanceAccounts({ data: { slot } }),
    enabled: open,
    refetchInterval: open ? GLANCE_INTERVAL_MS : false,
    staleTime: 0,
  });
}
