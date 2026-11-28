import { Avatar, DropdownMenu, type MenuItemProps, useUiCopy, VisuallyHidden } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';
import { AccentRing, type AccentRingAccent } from '../identity/accent-ring';
import { accountMenuStyles } from './account-menu.variants';

export interface AccountMenuTriggerProps extends ComponentPropsWithRef<'button'> {
  /** The monogram the avatar shows until the picture loads: the viewer's `initials` kind, rendered by the caller. */
  initials: string;
  imageUrl?: string | null;
  /** The ring of the identity the tab acts as; none in a browser of one account and one channel. */
  accent?: AccentRingAccent;
}

/** The header avatar that opens the account menu. */
export function AccountMenuTrigger({
  initials,
  imageUrl,
  accent,
  className,
  ...props
}: AccountMenuTriggerProps) {
  const { account } = useUiCopy();
  const avatar = (
    <Avatar.Root size="md">
      {imageUrl ? <Avatar.Image src={imageUrl} alt="" /> : null}
      <Avatar.Fallback aria-hidden="true">{initials}</Avatar.Fallback>
    </Avatar.Root>
  );

  return (
    <DropdownMenu.Trigger asChild>
      <button
        type="button"
        data-slot="account-menu-trigger"
        className={accountMenuStyles().trigger({ className })}
        {...props}
      >
        {accent ? <AccentRing accent={accent}>{avatar}</AccentRing> : avatar}
        <VisuallyHidden>{account}</VisuallyHidden>
      </button>
    </DropdownMenu.Trigger>
  );
}

/** A menu row; an `asChild` link takes the row's colour instead of the browser's. */
export function AccountMenuItem({ className, ...props }: MenuItemProps) {
  return <DropdownMenu.Item className={accountMenuStyles().item({ className })} {...props} />;
}
