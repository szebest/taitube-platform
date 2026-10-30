import { Link, useLocation } from '@tanstack/react-router';
import { AccountMenu } from '@vp/components';
import { useT } from '@vp/intl-react';
import { canAccessAdmin } from '@vp/permissions';
import { Can } from '@vp/permissions-react';
import { useAccount, useSignOut } from '@vp/queries';
import { Button } from '@vp/ui';

/** The creator's account in the toolbar: a guest's way to sign in, or the channel's menu with upload, admin and sign-out. */
export function ShellAccountMenu() {
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
    <AccountMenu.Root>
      <AccountMenu.Trigger
        name={account.channel.displayName}
        imageUrl={account.channel.avatarUrl}
      />
      <AccountMenu.Content align="end">
        <AccountMenu.Label>{account.channel.displayName}</AccountMenu.Label>
        <AccountMenu.Item asChild>
          <Link to="/upload">{tOr('auth.upload', {}, '')}</Link>
        </AccountMenu.Item>
        <Can type="rule" I={canAccessAdmin}>
          <AccountMenu.Item asChild>
            <a href="/admin">{tOr('auth.admin', {}, '')}</a>
          </AccountMenu.Item>
        </Can>
        <AccountMenu.Separator />
        <AccountMenu.Item onSelect={signOut}>{tOr('auth.signOut', {}, '')}</AccountMenu.Item>
      </AccountMenu.Content>
    </AccountMenu.Root>
  );
}
