import { AccountMenu } from '@kit/components';
import { assertNever } from '@kit/result';
import { Link, useRouter } from '@tanstack/react-router';

/** A page of the app the account menu and the sheet list: one of this app's routes, or another app's address. */
export type AccountLink =
  | { readonly kind: 'route'; readonly label: string; readonly to: string }
  | { readonly kind: 'url'; readonly label: string; readonly href: string };

/** The link as a menu row: a route keeps the tab's identity prefix through the router. */
export function AccountMenuLink({ link }: { link: AccountLink }) {
  switch (link.kind) {
    case 'route':
      return (
        <AccountMenu.Item asChild>
          <Link to={link.to}>{link.label}</Link>
        </AccountMenu.Item>
      );
    case 'url':
      return (
        <AccountMenu.Item asChild>
          <a href={link.href}>{link.label}</a>
        </AccountMenu.Item>
      );
    default:
      return assertNever(link, 'account link');
  }
}

/** Follows a link chosen from a list that holds no anchors, such as the switcher's sheet. */
export function useFollowLink(): (link: AccountLink) => void {
  const router = useRouter();

  return (link) => {
    switch (link.kind) {
      case 'route':
        void router.navigate({ to: link.to });
        return;
      case 'url':
        window.location.assign(link.href);
        return;
      default:
        assertNever(link, 'account link');
    }
  };
}
