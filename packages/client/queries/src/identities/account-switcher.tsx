import { AccountMenu, jumpToIdentityItem, IDENTITY_ITEM } from '@kit/components';
import { useT } from '@kit/intl-react';
import { COMPACT_QUERY, DropdownMenu, useMediaQuery } from '@kit/ui';
import { Link, useLocation } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { useAccount } from '../session-provider';
import { useSignOut, useSignOutAll } from '../use-sign-out';
import { type AccountLink, AccountMenuLink } from './account-links';
import { IdentityEntryRow } from './identity-entry-row';
import { useIdentitySwitcher } from './identity-switcher-provider';
import { useIdentityChoices } from './use-identity-choices';

/** Past this many identities the menu sends the viewer to the searchable list instead of listing them. */
export const MENU_ROWS_MAX = 5;

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
 * The header's account button for a signed-in viewer, in the ring of the identity the tab acts as.
 * On a wide screen it opens a menu: the identities (up to five, else a way to the searchable list),
 * the ways to add an account, create a channel, manage, and sign out of one account or all, then
 * the app's pages; on a narrow one it opens the switcher's bottom sheet. The name and ring change on
 * the click, before the new identity's session has loaded.
 */
export function AccountSwitcher({ links, manage, children, onSignOut }: AccountSwitcherProps) {
  const { tOr } = useT();
  const account = useAccount();
  const compact = useMediaQuery(COMPACT_QUERY);
  const [open, setOpen] = useState(false);
  const { show, pending } = useIdentitySwitcher();
  const { entries, current, canAdd, choose, prefetch } = useIdentityChoices(open);
  const signOut = useSignOut();
  const signOutAll = useSignOutAll();
  const redirect = useLocation({ select: (location) => location.href });

  if (!account) return null;

  const shown = pending ?? {
    name: current?.name ?? account.channel.displayName,
    avatarUrl: current?.avatarUrl ?? account.channel.avatarUrl,
    accent: current?.accent,
  };
  const several = entries.length > 1;
  const listed = entries.length <= MENU_ROWS_MAX;
  const accounts = new Set(entries.map(({ identity }) => identity.slot)).size;

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
        name={shown.name}
        imageUrl={shown.avatarUrl}
        accent={several ? shown.accent : undefined}
      />
      <AccountMenu.Content align="end" className="min-w-64" onKeyDown={jumpToIdentityItem}>
        <AccountMenu.Label>{tOr('accounts.groupAccounts', {}, '')}</AccountMenu.Label>
        {listed ? (
          <DropdownMenu.RadioGroup value={current?.key}>
            {entries.map((entry) => (
              <DropdownMenu.RadioItem
                key={entry.key}
                value={entry.key}
                {...{ [IDENTITY_ITEM]: '' }}
                onFocus={() => prefetch(entry)}
                onSelect={() => choose(entry)}
              >
                <IdentityEntryRow entry={entry} check={false} />
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        ) : (
          <AccountMenu.Item onSelect={() => show('switcher')}>
            {tOr('accounts.switcherOpen', {}, '')}
            <DropdownMenu.Shortcut>
              {tOr('accounts.switcherShortcut', {}, '')}
            </DropdownMenu.Shortcut>
          </AccountMenu.Item>
        )}
        <AccountMenu.Separator />
        <AccountMenu.Item asChild disabled={!canAdd}>
          <Link to="/login" search={{ add: '1', redirect }}>
            {tOr('accounts.addAccount', {}, '')}
          </Link>
        </AccountMenu.Item>
        <AccountMenu.Item onSelect={() => show('create-channel')}>
          {tOr('accounts.createChannel', {}, '')}
        </AccountMenu.Item>
        <AccountMenuLink link={manage} />
        <AccountMenu.Separator />
        {links.map((link) => (
          <AccountMenuLink key={link.label} link={link} />
        ))}
        {children}
        <AccountMenu.Separator />
        <AccountMenu.Item
          onSelect={() => {
            onSignOut?.();
            void signOut();
          }}
        >
          {tOr(accounts > 1 ? 'accounts.signOutThis' : 'auth.signOut', {}, '')}
        </AccountMenu.Item>
        {accounts > 1 && (
          <AccountMenu.Item
            onSelect={() => {
              onSignOut?.();
              void signOutAll();
            }}
          >
            {tOr('accounts.signOutAll', {}, '')}
          </AccountMenu.Item>
        )}
      </AccountMenu.Content>
    </AccountMenu.Root>
  );
}
