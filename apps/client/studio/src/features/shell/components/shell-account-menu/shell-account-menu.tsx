import { AccountMenu } from '@kit/components';
import { AppearanceMenuGroups, DropdownMenu, ThemeMenu, useUiCopy } from '@kit/ui';
import {
  AccountSwitcher,
  SignInButton,
  useAccount,
  useAppLink,
  useIdentityDocument,
} from '@vp/queries';
import type { PropsWithChildren } from 'react';
import { useAccountLinks } from '#app/features/shell/hooks/use-account-links';
import { WEB_URL } from '#app/lib/config';
import { useT } from '#app/lib/messages';

/**
 * The creator's account in the toolbar: a guest's way to sign in, or the switcher between their
 * accounts and channels with upload, customization, admin, appearance and sign-out. `children` are
 * entries for the channel the studio acts on.
 */
export function ShellAccountMenu({ children }: PropsWithChildren) {
  const account = useAccount();
  const appLink = useAppLink();
  const { tOr } = useT();
  const { appearance } = useUiCopy();
  const { links, manage } = useAccountLinks();
  useIdentityDocument();

  if (!account) {
    return (
      <>
        <ThemeMenu />
        <SignInButton />
      </>
    );
  }

  return (
    <AccountSwitcher links={links} manage={manage}>
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger>{appearance}</DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent className="min-w-44">
          <AppearanceMenuGroups />
          <DropdownMenu.Separator />
          <AccountMenu.Item asChild>
            <a href={appLink(WEB_URL, '/settings/appearance')}>
              {tOr('studio.appearanceSettings', {}, '')}
            </a>
          </AccountMenu.Item>
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
      {children}
    </AccountSwitcher>
  );
}
