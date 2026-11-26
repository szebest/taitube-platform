import { IdentitySwitcherDialog } from '@vp/queries';
import { useAccountLinks } from '#app/features/shell/hooks/use-account-links';

/** The switcher's searchable dialog and phone sheet, with the pages the account menu lists. */
export function StudioIdentitySwitcherSheet() {
  const { links, manage } = useAccountLinks();

  return <IdentitySwitcherDialog links={links} manage={manage} />;
}
