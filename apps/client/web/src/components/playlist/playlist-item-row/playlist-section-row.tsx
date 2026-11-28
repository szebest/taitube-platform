import { cn, Icon } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';
import { PlaylistSectionRowContext, usePlaylistSectionRow } from './playlist-section-row.context';

export interface PlaylistSectionRowRootProps extends ComponentPropsWithRef<'div'> {
  folded: boolean;
  onFoldedChange: (folded: boolean) => void;
}

/** A divider in the playlist that names a section and folds the entries under it. */
export function PlaylistSectionRowRoot({
  folded,
  onFoldedChange,
  className,
  ...props
}: PlaylistSectionRowRootProps) {
  return (
    <PlaylistSectionRowContext value={{ folded, onFoldedChange }}>
      <div
        data-slot="playlist-section-row"
        data-folded={folded || undefined}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-inline border-b-divider border-border py-1',
          className
        )}
        {...props}
      />
    </PlaylistSectionRowContext>
  );
}

/** The button that folds the section; the title is its name. */
export function PlaylistSectionRowTitle({
  className,
  children,
  ...props
}: Omit<ComponentPropsWithRef<'button'>, 'type' | 'aria-expanded'>) {
  const { folded, onFoldedChange } = usePlaylistSectionRow('Title');

  return (
    <button
      type="button"
      data-slot="playlist-section-row-title"
      aria-expanded={!folded}
      className={cn(
        'flex min-w-0 cursor-pointer items-center gap-1 rounded-control border-0 bg-transparent p-0 text-start font-sans text-title text-fg focus-ring',
        className
      )}
      onClick={() => onFoldedChange(!folded)}
      {...props}
    >
      <Icon
        name="chevron-down"
        className={cn(
          'transition-transform duration-fast ease-standard motion-reduce:transition-none',
          folded && '-rotate-90 rtl:rotate-90'
        )}
      />
      <span className="truncate">{children}</span>
    </button>
  );
}

export function PlaylistSectionRowCount({ className, ...props }: ComponentPropsWithRef<'span'>) {
  return (
    <span
      data-slot="playlist-section-row-count"
      className={cn('shrink-0 text-caption text-fg-muted', className)}
      {...props}
    />
  );
}

export function PlaylistSectionRowActions({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="playlist-section-row-actions"
      className={cn('ms-auto flex shrink-0 items-center gap-1', className)}
      {...props}
    />
  );
}
