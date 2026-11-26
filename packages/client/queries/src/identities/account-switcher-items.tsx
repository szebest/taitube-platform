import { AccountMenu, IDENTITY_ITEM } from '@kit/components';
import { DropdownMenu } from '@kit/ui';
import { Link, useLocation } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useT } from '../intl/shared-words';
import { useSignOut, useSignOutAll } from '../use-sign-out';
import { type AccountLink, AccountMenuLink } from './account-links';
import { IdentityEntryRow } from './identity-entry-row';
import { useIdentitySwitcher } from './identity-switcher-provider';
import { useIdentityChoices } from './use-identity-choices';

/** Past this many identities the menu sends the viewer to the searchable list instead of listing them. */
export const MENU_ROWS_MAX = 5;

export interface AccountSwitcherItemsProps {
  links: readonly AccountLink[];
  manage: AccountLink;
  children?: ReactNode;
  onSignOut?: () => void;
}

/**
 * The account menu's rows, loaded the first time it opens: the identities (up to five, else a way
 * to the searchable list), add an account, create a channel, manage, the app's pages, and sign out
 * of one account or all.
 */
export function AccountSwitcherItems({
  links,
  manage,
  children,
  onSignOut,
}: AccountSwitcherItemsProps) {
  const { tOr } = useT();
  const { show } = useIdentitySwitcher();
  const { entries, current, canAdd, choose, prefetch } = useIdentityChoices(true);
  const signOut = useSignOut();
  const signOutAll = useSignOutAll();
  const redirect = useLocation({ select: (location) => location.href });
  const listed = entries.length <= MENU_ROWS_MAX;
  const accounts = new Set(entries.map(({ identity }) => identity.slot)).size;

  return (
    <>
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
          <DropdownMenu.Shortcut>{tOr('accounts.switcherShortcut', {}, '')}</DropdownMenu.Shortcut>
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
    </>
  );
}
