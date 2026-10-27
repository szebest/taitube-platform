import { Link, useLocation } from '@tanstack/react-router';
import { AccountMenu as Menu } from '@vp/components';
import { useT } from '@vp/intl-react';
import { canAccessAdmin } from '@vp/permissions';
import { Can } from '@vp/permissions-react';
import { useAccount, useSignOut } from '@vp/queries';
import { Button } from '@vp/ui';

/** The viewer's account in the header: a guest's way to sign in, or the channel's menu with the studio's pages and sign-out. */
export function AccountMenu() {
  const account = useAccount();
  const signOut = useSignOut();
  const href = useLocation({ select: (location) => location.href });
  const { tOr } = useT();

  if (!account) {
    return (
      <Button asChild variant="outline">
        <Link to="/login" search={{ redirect: href }}>
          {tOr('auth.signIn', {}, '')}
        </Link>
      </Button>
    );
  }

  return (
    <Menu.Root>
      <Menu.Trigger name={account.channel.displayName} imageUrl={account.channel.avatarUrl} />
      <Menu.Content align="end">
        <Menu.Label>{account.channel.displayName}</Menu.Label>
        <Menu.Item asChild>
          <a href={'/upload'}>{tOr('auth.upload', {}, '')}</a>
        </Menu.Item>
        <Can type="rule" I={canAccessAdmin}>
          <Menu.Item asChild>
            <a href={'/admin'}>{tOr('auth.admin', {}, '')}</a>
          </Menu.Item>
        </Can>
        <Menu.Separator />
        <Menu.Item onSelect={signOut}>{tOr('auth.signOut', {}, '')}</Menu.Item>
      </Menu.Content>
    </Menu.Root>
  );
}
