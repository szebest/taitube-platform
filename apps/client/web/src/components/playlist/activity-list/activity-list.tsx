import { Avatar, cn } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';

/** A playlist's changes, newest first; pass `aria-label`. */
export function ActivityListRoot({ className, ...props }: ComponentPropsWithRef<'ol'>) {
  return (
    <ol
      data-slot="activity-list"
      className={cn('m-0 flex list-none flex-col p-0', className)}
      {...props}
    />
  );
}

export function ActivityListItem({ className, ...props }: ComponentPropsWithRef<'li'>) {
  return (
    <li
      data-slot="activity-list-item"
      className={cn(
        'grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-inline border-b-divider border-border py-2 last:border-b-0',
        className
      )}
      {...props}
    />
  );
}

export interface ActivityListAvatarProps extends ComponentPropsWithRef<'span'> {
  src: string | undefined;
  name: string;
}

export function ActivityListAvatar({ src, name, className, ...props }: ActivityListAvatarProps) {
  return (
    <Avatar.Root
      size="sm"
      aria-hidden="true"
      data-slot="activity-list-avatar"
      className={cn('col-start-1 row-start-1 row-span-2', className)}
      {...props}
    >
      {src && <Avatar.Image src={src} alt="" />}
      <Avatar.Fallback>{name.slice(0, 1)}</Avatar.Fallback>
    </Avatar.Root>
  );
}

/** The finished sentence ("Ana added Lisbon trams"). */
export function ActivityListText({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="activity-list-text"
      className={cn('col-start-2 row-start-1 m-0 min-w-0 text-body-sm wrap-break-word', className)}
      {...props}
    />
  );
}

export interface ActivityListTimeProps extends ComponentPropsWithRef<'time'> {
  dateTime: string;
}

export function ActivityListTime({ className, ...props }: ActivityListTimeProps) {
  return (
    <time
      data-slot="activity-list-time"
      className={cn('col-start-2 row-start-2 text-caption text-fg-muted', className)}
      {...props}
    />
  );
}

/** The caller's follow-up for an entry, such as Restore. */
export function ActivityListAction({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="activity-list-action"
      className={cn('col-start-3 row-start-1 row-span-2 ms-inline', className)}
      {...props}
    />
  );
}
