import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { NO_ACCOUNTS } from '../accounts';
import { useApi } from '../api-provider';
import { useAccount, useIdentity } from '../session-provider';
import { type IdentityEntry, identityEntries } from './identity-entries';
import {
  accountGlanceQueryOptions,
  accountsListQueryOptions,
  identitiesQueryOptions,
} from './identity-queries';
import { type SwitchTarget, useIdentitySwitcher } from './identity-switcher-provider';
import { prefetchIdentity } from './switch-flow';

export type IdentityChoices = {
  entries: IdentityEntry[];
  current: IdentityEntry | undefined;
  /** Whether another account fits beside the ones signed in. */
  canAdd: boolean;
  choose: (entry: IdentityEntry) => void;
  prefetch: (entry: IdentityEntry) => void;
  targetOf: (entry: IdentityEntry) => SwitchTarget;
};

/**
 * Every identity the switcher offers this tab and what choosing one does: the current one nothing,
 * an expired one signs that slot in again and comes back here, any other switches in place. The
 * other accounts' counts are asked only while `open`.
 */
export function useIdentityChoices(open: boolean): IdentityChoices {
  const router = useRouter();
  const api = useApi();
  const tab = useIdentity();
  const account = useAccount();
  const { switchTo, show } = useIdentitySwitcher();
  const listed = useQuery(accountsListQueryOptions()).data;
  const accounts = listed ?? NO_ACCOUNTS;
  const mine = useQuery({ ...identitiesQueryOptions(api), enabled: account !== undefined }).data;
  const several = accounts.slots.length > 1;
  const glances = useQuery(accountGlanceQueryOptions(tab.slot, open && several)).data;

  const entries = identityEntries({ accounts, tab, mine, glances });
  const current = entries.find((entry) => entry.current);
  const targetOf = (entry: IdentityEntry): SwitchTarget => ({
    identity: entry.identity,
    prefixed: several || entry.identity.channel !== undefined,
    display: { name: entry.name, avatarUrl: entry.avatarUrl, accent: entry.accent },
  });

  const choose = (entry: IdentityEntry) => {
    show('closed');
    if (entry.current) return;
    if (entry.expired) {
      const { slot } = entry.identity;
      const redirect = router.state.location.href;
      void router.navigate({ to: '/login', search: { slot, reason: 'expired', redirect } });
      return;
    }
    void switchTo(targetOf(entry), current && targetOf(current));
  };

  const prefetch = (entry: IdentityEntry) => {
    if (entry.current || entry.expired) return;
    const { identity, prefixed } = targetOf(entry);
    prefetchIdentity(router, { identity, prefixed });
  };

  return {
    entries,
    current,
    canAdd: listed !== undefined && accounts.slots.length < listed.accountsMax,
    choose,
    prefetch,
    targetOf,
  };
}
