import { Avatar, cn } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

/** What the team changed, one row each, newest first; name the list with `aria-label`. */
export function AuditLogListRoot({ className, ...props }: ComponentPropsWithRef<'ul'>) {
  return (
    <ul
      data-slot="audit-log-list"
      className={cn('m-0 flex list-none flex-col p-0', className)}
      {...props}
    />
  );
}

export function AuditLogListItem({ className, ...props }: ComponentPropsWithRef<'li'>) {
  return (
    <li
      data-slot="audit-log-list-item"
      className={cn(
        'grid grid-cols-[auto_1fr_auto] items-start gap-inline border-b border-divider py-stack last:border-b-0',
        className
      )}
      {...props}
    />
  );
}

export interface AuditLogListAvatarProps {
  /** The actor's name; the avatar is decoration beside it, so the picture has no text of its own. */
  name: string;
  imageUrl?: string | null;
}

export function AuditLogListAvatar({ name, imageUrl }: AuditLogListAvatarProps) {
  return (
    <Avatar.Root data-slot="audit-log-list-avatar" size="md">
      {imageUrl ? <Avatar.Image src={imageUrl} alt="" /> : null}
      <Avatar.Fallback aria-hidden="true">{name.slice(0, 1).toUpperCase()}</Avatar.Fallback>
    </Avatar.Root>
  );
}

export function AuditLogListBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="audit-log-list-body"
      className={cn('flex min-w-0 flex-col gap-1', className)}
      {...props}
    />
  );
}

export function AuditLogListActor({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return (
    <span
      data-slot="audit-log-list-actor"
      className={cn('text-label text-fg', className)}
      {...props}
    />
  );
}

export function AuditLogListAction({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return (
    <span
      data-slot="audit-log-list-action"
      className={cn('flex flex-wrap items-center gap-inline text-body text-fg', className)}
      {...props}
    />
  );
}

export function AuditLogListDetail({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return (
    <span
      data-slot="audit-log-list-detail"
      className={cn('text-caption text-fg-muted', className)}
      {...props}
    />
  );
}

export function AuditLogListTime({ className, ...props }: ComponentPropsWithRef<'time'>) {
  return (
    <time
      data-slot="audit-log-list-time"
      className={cn('whitespace-nowrap text-caption text-fg-muted tabular-nums', className)}
      {...props}
    />
  );
}
