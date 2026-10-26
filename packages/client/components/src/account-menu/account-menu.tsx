import { Avatar, DropdownMenu, type MenuItemProps, useUiCopy, VisuallyHidden } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';
import { accountMenuStyles } from './account-menu.variants';

const INITIALS = 2;

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word !== '')
    .slice(0, INITIALS)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

export interface AccountMenuTriggerProps extends ComponentPropsWithRef<'button'> {
  /** The viewer's channel name, drawn as its initials until the picture loads. */
  name: string;
  imageUrl?: string | null;
}

/** The header avatar that opens the account menu. */
export function AccountMenuTrigger({
  name,
  imageUrl,
  className,
  ...props
}: AccountMenuTriggerProps) {
  const { account } = useUiCopy();

  return (
    <DropdownMenu.Trigger asChild>
      <button
        type="button"
        data-slot="account-menu-trigger"
        className={accountMenuStyles().trigger({ className })}
        {...props}
      >
        <Avatar.Root size="md">
          {imageUrl ? <Avatar.Image src={imageUrl} alt="" /> : null}
          <Avatar.Fallback aria-hidden="true">{initialsOf(name)}</Avatar.Fallback>
        </Avatar.Root>
        <VisuallyHidden>{account}</VisuallyHidden>
      </button>
    </DropdownMenu.Trigger>
  );
}

/** A menu row; an `asChild` link takes the row's colour instead of the browser's. */
export function AccountMenuItem({ className, ...props }: MenuItemProps) {
  return <DropdownMenu.Item className={accountMenuStyles().item({ className })} {...props} />;
}
