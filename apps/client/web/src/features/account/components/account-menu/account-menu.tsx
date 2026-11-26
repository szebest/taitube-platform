import { AccountSwitcher, SignInButton, useAccount, useIdentityDocument } from '@vp/queries';
import { useAccountLinks } from '#app/features/account/hooks/use-account-links';
import { clearQueuedChanges } from '#app/integrations/service-worker-client/clear-queued-changes';

/**
 * The viewer's account in the header: a guest's way to sign in, or the switcher between their
 * accounts and channels with the studio's pages and sign-out; the tab's title and icon say when it
 * acts as another identity than the browser's default.
 */
export function AccountMenu() {
  const account = useAccount();
  const { links, manage } = useAccountLinks();
  useIdentityDocument();

  if (!account) {
    return <SignInButton />;
  }

  return <AccountSwitcher links={links} manage={manage} onSignOut={clearQueuedChanges} />;
}
