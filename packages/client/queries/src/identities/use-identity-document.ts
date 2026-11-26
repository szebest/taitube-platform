import { useT } from '@kit/intl-react';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';
import { identityKey } from '../account-slots';
import { useIdentity } from '../session-provider';
import { accountsListQueryOptions } from './identity-queries';
import { useIdentityChoices } from './use-identity-choices';

const loadDocumentMarks = () => import('./identity-document');

/**
 * A tab acting as anything but the browser's default identity says so outside the page too: its
 * title starts with the handle, and its icon carries a dot in the identity's accent.
 */
export function useIdentityDocument(): void {
  const { tOr } = useT();
  const tab = useIdentity();
  const accounts = useQuery(accountsListQueryOptions()).data;
  const { current } = useIdentityChoices(false);

  const defaultRow = accounts?.slots.find(({ slot }) => slot === accounts.defaultSlot);
  const defaultKey =
    accounts &&
    identityKey({ slot: accounts.defaultSlot, channel: defaultRow?.channel ?? undefined });
  const elsewhere = defaultKey !== undefined && identityKey(tab) !== defaultKey;
  const handle = elsewhere ? current?.handle : undefined;
  const accent = current?.accent;
  const prefixed = useEffectEvent((title: string) =>
    tOr('accounts.tabTitle', { handle: handle ?? '', title }, title)
  );

  useEffect(() => {
    if (handle === undefined || accent === undefined) return;
    let unmark: (() => void) | undefined;
    let live = true;
    void loadDocumentMarks().then(({ markDocument }) => {
      if (live) unmark = markDocument(prefixed, accent);
    });
    return () => {
      live = false;
      unmark?.();
    };
  }, [handle, accent]);
}
