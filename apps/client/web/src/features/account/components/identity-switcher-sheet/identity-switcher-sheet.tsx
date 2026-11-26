import { IdentitySwitcherDialog } from '@vp/queries';
import { useAccountLinks } from '#app/features/account/hooks/use-account-links';

/** The switcher's searchable dialog and phone sheet, with the same pages the account menu lists. */
export function IdentitySwitcherSheet() {
  const { links, manage } = useAccountLinks();

  return <IdentitySwitcherDialog links={links} manage={manage} />;
}
