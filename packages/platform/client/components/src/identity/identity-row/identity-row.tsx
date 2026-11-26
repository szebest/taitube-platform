import { Avatar, Badge, Icon, cn } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';
import { initialsOf } from '../../account-menu/account-menu';
import { AccentRing, type AccentRingAccent } from '../accent-ring';
import { IdentityRowContext, useIdentityRow } from './identity-row.context';

export interface IdentityRowRootProps extends ComponentPropsWithRef<'span'> {
  /** The identity the tab acts as now; its row carries the check. */
  current?: boolean;
  /** The account's session ended: the row stays, muted, and its detail says how to come back. */
  expired?: boolean;
}

/** One account or channel in a switcher list: avatar, name, a detail line, an unread count and a check. */
export function IdentityRowRoot({
  current = false,
  expired = false,
  className,
  ...props
}: IdentityRowRootProps) {
  return (
    <IdentityRowContext value={{ current, expired }}>
      <span
        data-slot="identity-row"
        data-current={current || undefined}
        data-expired={expired || undefined}
        className={cn('flex w-full min-w-0 items-center gap-inline', className)}
        {...props}
      />
    </IdentityRowContext>
  );
}

export interface IdentityRowAvatarProps {
  name: string;
  imageUrl?: string | null;
  /** Draws the identity's ring; none for a row that only lists it. */
  accent?: AccentRingAccent;
}

export function IdentityRowAvatar({ name, imageUrl, accent }: IdentityRowAvatarProps) {
  const { expired } = useIdentityRow('Avatar');
  const avatar = (
    <Avatar.Root size="sm" className={cn(expired && 'opacity-60')}>
      {imageUrl ? <Avatar.Image src={imageUrl} alt="" /> : null}
      <Avatar.Fallback aria-hidden="true">{initialsOf(name)}</Avatar.Fallback>
    </Avatar.Root>
  );

  return accent ? <AccentRing accent={accent}>{avatar}</AccentRing> : avatar;
}

/** The name above its detail line, both cut short rather than wrapped. */
export function IdentityRowText({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return <span className={cn('flex min-w-0 flex-1 flex-col', className)} {...props} />;
}

export function IdentityRowName({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return <span className={cn('truncate text-body-sm text-fg', className)} {...props} />;
}

/** The handle, a role, or for an expired row the way to sign in again. */
export function IdentityRowDetail({ className, ...props }: ComponentPropsWithRef<'span'>) {
  const { expired } = useIdentityRow('Detail');

  return (
    <span
      className={cn(
        'truncate text-caption',
        expired ? 'text-warning-ink' : 'text-fg-muted',
        className
      )}
      {...props}
    />
  );
}

/** The count of what waits on that identity, its words from the caller. */
export function IdentityRowUnread(props: ComponentPropsWithRef<'span'>) {
  return <Badge variant="soft" tone="accent" size="sm" {...props} />;
}

/** The check on the current row; the others keep its width, so names line up. */
export function IdentityRowCheck({ className }: { className?: string }) {
  const { current } = useIdentityRow('Check');

  return (
    <Icon
      name="check"
      size="sm"
      className={cn('shrink-0 text-accent-ink', !current && 'invisible', className)}
    />
  );
}
