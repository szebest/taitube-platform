import { Link, useLocation, useRouter } from '@tanstack/react-router';
import { useT } from '@vp/intl-react';
import { canAccessAdmin } from '@vp/permissions';
import { Can } from '@vp/permissions-react';

import { settleSession } from './session-changes';
import { signOut } from './session-functions';
import { useAccount } from './session-provider';

export type AccountMenuProps = {
  /** Where the creator studio is, whose upload and admin pages the menu links to; empty is this origin. */
  studioUrl: string;
};

/**
 * The viewer's account in either app's header: a guest's way to sign in, or the signed-in channel with
 * the studio's pages, the admin panel when `@vp/permissions` grants it, and sign-out. Plain markup.
 */
export function AccountMenu({ studioUrl }: AccountMenuProps) {
  const account = useAccount();
  const router = useRouter();
  const href = useLocation({ select: (location) => location.href });
  const { tOr } = useT();

  if (!account) {
    return (
      <Link to="/login" search={{ redirect: href }}>
        {tOr('auth.signIn', {}, '')}
      </Link>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    await settleSession(router);
  };

  return (
    <nav aria-label={tOr('auth.account', {}, '')}>
      <span>{account.channel.displayName}</span>
      <ul>
        <li>
          <a href={`${studioUrl}/upload`}>{tOr('auth.upload', {}, '')}</a>
        </li>
        <Can type="rule" I={canAccessAdmin}>
          <li>
            <a href={`${studioUrl}/admin`}>{tOr('auth.admin', {}, '')}</a>
          </li>
        </Can>
        <li>
          <button type="button" onClick={handleSignOut}>
            {tOr('auth.signOut', {}, '')}
          </button>
        </li>
      </ul>
    </nav>
  );
}
