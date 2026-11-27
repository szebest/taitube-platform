import { Avatar, cn } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';

/** The people who can edit a playlist, one row each; pass `aria-label`. */
export function CollaboratorListRoot({ className, ...props }: ComponentPropsWithRef<'ul'>) {
  return (
    <ul
      data-slot="collaborator-list"
      className={cn('m-0 flex list-none flex-col gap-1 p-0', className)}
      {...props}
    />
  );
}

export function CollaboratorListItem({ className, ...props }: ComponentPropsWithRef<'li'>) {
  return (
    <li
      data-slot="collaborator-list-item"
      className={cn(
        'grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-inline rounded-card p-1',
        className
      )}
      {...props}
    />
  );
}

export interface CollaboratorListAvatarProps extends ComponentPropsWithRef<'span'> {
  src: string | undefined;
  name: string;
}

export function CollaboratorListAvatar({
  src,
  name,
  className,
  ...props
}: CollaboratorListAvatarProps) {
  return (
    <Avatar.Root
      aria-hidden="true"
      data-slot="collaborator-list-avatar"
      className={cn('col-start-1 row-start-1 row-span-2', className)}
      {...props}
    >
      {src && <Avatar.Image src={src} alt="" />}
      <Avatar.Fallback>{name.slice(0, 1)}</Avatar.Fallback>
    </Avatar.Root>
  );
}

export function CollaboratorListName({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return (
    <span
      data-slot="collaborator-list-name"
      className={cn('col-start-2 row-start-1 truncate text-label', className)}
      {...props}
    />
  );
}

/** A line under the name, finished by the caller ("Owner", "Joined 3 days ago"). */
export function CollaboratorListMeta({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return (
    <span
      data-slot="collaborator-list-meta"
      className={cn('col-start-2 row-start-2 truncate text-caption text-fg-muted', className)}
      {...props}
    />
  );
}

/** The caller's role select and remove button, at the row's end. */
export function CollaboratorListActions({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="collaborator-list-actions"
      className={cn(
        'col-start-3 row-start-1 row-span-2 ms-inline flex items-center gap-1',
        className
      )}
      {...props}
    />
  );
}
