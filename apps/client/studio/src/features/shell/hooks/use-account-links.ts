import { useT } from '@kit/intl-react';
import { canAccessAdmin } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { type AccountLink, useAppLink } from '@vp/queries';
import { WEB_URL } from '#app/lib/config';

/** The studio's pages the account menu and the switcher's sheet list; the accounts are managed on web. */
export function useAccountLinks(): { links: AccountLink[]; manage: AccountLink } {
  const { tOr } = useT();
  const appLink = useAppLink();
  const admin = useCan(canAccessAdmin);
  const links: AccountLink[] = [
    { kind: 'route', label: tOr('auth.upload', {}, ''), to: '/upload' },
    { kind: 'route', label: tOr('studio.navCustomization', {}, ''), to: '/customization' },
  ];
  if (admin) links.push({ kind: 'route', label: tOr('auth.admin', {}, ''), to: '/admin' });
  return {
    links,
    manage: {
      kind: 'url',
      label: tOr('accounts.manage', {}, ''),
      href: appLink(WEB_URL, '/settings/accounts'),
    },
  };
}
