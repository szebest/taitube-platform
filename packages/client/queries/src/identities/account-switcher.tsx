import { AccountMenu, jumpToIdentityItem } from '@kit/components';
import { useFormat } from '@kit/intl-react';
import { unwrapOr } from '@kit/result';
import { COMPACT_QUERY, useMediaQuery } from '@kit/ui';
import { type ReactNode, useState } from 'react';
import { useAccount } from '../session-provider';
import type { AccountLink } from './account-links';
import { LazyAccountSwitcherItems } from './account-switcher-items.lazy';
import { useIdentitySwitcher } from './identity-switcher-provider';
import { useIdentityChoices } from './use-identity-choices';

export interface AccountSwitcherProps {
  /** The app's own pages, listed under the identities. */
  links: readonly AccountLink[];
  /** Where the accounts are managed: web's `/settings/accounts`. */
  manage: AccountLink;
  /** More of the app's own menu, on a wide screen only: an appearance submenu, a team to leave. */
  children?: ReactNode;
  /** Runs before any sign-out, for what the app keeps of the viewer outside the session. */
  onSignOut?: () => void;
}

/**
 * The header's account button for a signed-in viewer, in the ring of the identity the tab acts as
 * once the browser holds more than one. On a wide screen it opens the account menu, whose rows load
 * as the pointer or focus reaches the button; on a narrow one it opens the switcher's bottom sheet.
 * The name and ring change on the click of a switch, before the new identity's session has loaded.
 */
export function AccountSwitcher({ children, ...items }: AccountSwitcherProps) {
  const account = useAccount();
  const compact = useMediaQuery(COMPACT_QUERY);
  const [open, setOpen] = useState(false);
  const { show, pending } = useIdentitySwitcher();
  const { entries, current } = useIdentityChoices(false);
  const { format } = useFormat();

  if (!account) return null;

  const shown = pending ?? {
    name: current?.name ?? account.channel.displayName,
    avatarUrl: current?.avatarUrl ?? account.channel.avatarUrl,
    accent: current?.accent,
  };
  const preload = () => void LazyAccountSwitcherItems.preload();

  const onOpenChange = (next: boolean) => {
    if (next && compact) {
      show('switcher');
      return;
    }
    setOpen(next);
  };

  return (
    <AccountMenu.Root open={open} onOpenChange={onOpenChange}>
      <AccountMenu.Trigger
        initials={unwrapOr(format({ type: 'initials', value: shown.name }), '')}
        imageUrl={shown.avatarUrl}
        accent={entries.length > 1 ? shown.accent : undefined}
        onPointerEnter={preload}
        onFocus={preload}
      />
      <AccountMenu.Content align="end" className="min-w-64" onKeyDown={jumpToIdentityItem}>
        <LazyAccountSwitcherItems {...items}>{children}</LazyAccountSwitcherItems>
      </AccountMenu.Content>
    </AccountMenu.Root>
  );
}
