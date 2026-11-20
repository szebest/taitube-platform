import { useT } from '@kit/intl-react';
import { canAccessAdmin } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { type AccountLink, useAppLink } from '@vp/queries';
import { STUDIO_URL } from '#app/lib/config';

/** The pages the account menu and the switcher's sheet list, the studio's opening as this tab's identity. */
export function useAccountLinks(): { links: AccountLink[]; manage: AccountLink } {
  const { tOr } = useT();
  const appLink = useAppLink();
  const admin = useCan(canAccessAdmin);
  const links: AccountLink[] = [
    { kind: 'url', label: tOr('auth.upload', {}, ''), href: appLink(STUDIO_URL, '/upload') },
    { kind: 'route', label: tOr('shell.settings', {}, ''), to: '/settings' },
  ];
  if (admin) {
    links.push({
      kind: 'url',
      label: tOr('auth.admin', {}, ''),
      href: appLink(STUDIO_URL, '/admin'),
    });
  }
  return {
    links,
    manage: { kind: 'route', label: tOr('accounts.manage', {}, ''), to: '/settings/accounts' },
  };
}
