import { Avatar, Button, cn } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';
import { AccentRing, type AccentRingAccent } from '../accent-ring';

/** The line above a composer that says which identity the write goes out as. */
export function ActingAsRoot({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="acting-as"
      className={cn(
        'm-0 flex min-w-0 items-center gap-inline text-caption text-fg-muted',
        className
      )}
      {...props}
    />
  );
}

export interface ActingAsAvatarProps {
  initials: string;
  imageUrl?: string | null;
  accent: AccentRingAccent;
}

export function ActingAsAvatar({ initials, imageUrl, accent }: ActingAsAvatarProps) {
  return (
    <AccentRing accent={accent} className="ring-1 ring-offset-1">
      <Avatar.Root size="xs">
        {imageUrl ? <Avatar.Image src={imageUrl} alt="" /> : null}
        <Avatar.Fallback aria-hidden="true">{initials}</Avatar.Fallback>
      </Avatar.Root>
    </AccentRing>
  );
}

/** "Commenting as ...", in the caller's words. */
export function ActingAsLabel({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return <span className={cn('min-w-0 truncate', className)} {...props} />;
}

/** Opens the switcher from the composer, so the identity changes without leaving the draft's page. */
export function ActingAsSwitch(props: ComponentPropsWithRef<'button'>) {
  return <Button type="button" variant="ghost" size="sm" {...props} />;
}
