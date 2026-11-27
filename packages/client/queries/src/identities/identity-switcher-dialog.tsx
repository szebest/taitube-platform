import { IdentitySwitcher } from '@kit/components';
import { useLocation, useRouter } from '@tanstack/react-router';
import { useT } from '../intl/shared-words';
import { useAccount } from '../session-provider';
import { useSignOut } from '../use-sign-out';
import { type AccountLink, useFollowLink } from './account-links';
import { MENU_ROWS_MAX } from './account-switcher-items';
import { CreateChannelDialog } from './create-channel-dialog';
import { IdentityEntryRow } from './identity-entry-row';
import { useIdentitySwitcher } from './identity-switcher-provider';
import { useIdentityChoices } from './use-identity-choices';

export interface IdentitySwitcherDialogProps {
  /** The app's own pages, listed after the identities, so the sheet stands in for the menu on a phone. */
  links: readonly AccountLink[];
  manage: AccountLink;
}

/**
 * The switcher as a searchable listbox, a dialog on a wide screen and a bottom sheet on a narrow
 * one: what the shortcut, the command palette, a composer's Switch, a long press on the tab bar and
 * a phone's account button open. A search field joins once there are more than five identities;
 * arrows, Enter and `1` to `9` choose, Escape closes and focus goes back where it was.
 */
export function IdentitySwitcherDialog({ links, manage }: IdentitySwitcherDialogProps) {
  const { tOr } = useT();
  const router = useRouter();
  const account = useAccount();
  const { panel, show } = useIdentitySwitcher();
  const open = panel === 'switcher';
  const { entries, canAdd, choose, prefetch } = useIdentityChoices(open);
  const follow = useFollowLink();
  const signOut = useSignOut();
  const redirect = useLocation({ select: (location) => location.href });

  if (!account) return null;

  const close = (next: boolean) => {
    if (!next) show('closed');
  };
  const run = (action: () => void) => () => {
    show('closed');
    action();
  };

  return (
    <>
      <IdentitySwitcher.Root open={open} onOpenChange={close}>
        <IdentitySwitcher.Content title={tOr('accounts.switcherTitle', {}, '')}>
          {entries.length > MENU_ROWS_MAX && (
            <IdentitySwitcher.Search placeholder={tOr('accounts.switcherSearch', {}, '')} />
          )}
          <IdentitySwitcher.List>
            <IdentitySwitcher.Empty />
            <IdentitySwitcher.Group heading={tOr('accounts.groupAccounts', {}, '')}>
              {entries.map((entry) => (
                <IdentitySwitcher.Item
                  key={entry.key}
                  value={entry.key}
                  keywords={[entry.name, entry.handle ?? '']}
                  onSelect={() => choose(entry)}
                  onPointerEnter={() => prefetch(entry)}
                  aria-current={entry.current || undefined}
                >
                  <IdentityEntryRow entry={entry} />
                </IdentitySwitcher.Item>
              ))}
            </IdentitySwitcher.Group>
            <IdentitySwitcher.Group>
              {canAdd && (
                <IdentitySwitcher.Action
                  value="add-account"
                  onSelect={run(
                    () => void router.navigate({ to: '/login', search: { add: '1', redirect } })
                  )}
                >
                  {tOr('accounts.addAccount', {}, '')}
                </IdentitySwitcher.Action>
              )}
              <IdentitySwitcher.Action
                value="create-channel"
                onSelect={() => show('create-channel')}
              >
                {tOr('accounts.createChannel', {}, '')}
              </IdentitySwitcher.Action>
              {[manage, ...links].map((link) => (
                <IdentitySwitcher.Action
                  key={link.label}
                  value={`link:${link.label}`}
                  onSelect={run(() => follow(link))}
                >
                  {link.label}
                </IdentitySwitcher.Action>
              ))}
              <IdentitySwitcher.Action value="sign-out" onSelect={run(() => void signOut())}>
                {tOr('accounts.signOutThis', {}, '')}
              </IdentitySwitcher.Action>
            </IdentitySwitcher.Group>
          </IdentitySwitcher.List>
        </IdentitySwitcher.Content>
      </IdentitySwitcher.Root>
      {panel === 'create-channel' && <CreateChannelDialog onClose={() => show('closed')} />}
    </>
  );
}
