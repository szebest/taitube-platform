import { Avatar, Checkbox, type CheckboxProps, cn, Icon, Tooltip } from '@kit/ui';
import type { ComponentPropsWithRef } from 'react';

export interface PlaylistItemRowRootProps extends ComponentPropsWithRef<'div'> {
  selected?: boolean;
}

/** One playlist entry, drawn inside a `SortableList.Item`: select, the caller's video row, its note and clip, who added it. */
export function PlaylistItemRowRoot({
  selected = false,
  className,
  ...props
}: PlaylistItemRowRootProps) {
  return (
    <div
      data-slot="playlist-item-row"
      data-selected={selected || undefined}
      className={cn(
        'grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)_auto] items-center rounded-card p-1 transition-colors duration-fast ease-standard data-selected:bg-accent-soft motion-reduce:transition-none',
        className
      )}
      {...props}
    />
  );
}

export interface PlaylistItemRowSelectProps extends Omit<
  CheckboxProps,
  'checked' | 'onCheckedChange' | 'aria-label'
> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  'aria-label': string;
}

export function PlaylistItemRowSelect({
  onCheckedChange,
  className,
  ...props
}: PlaylistItemRowSelectProps) {
  return (
    <Checkbox
      data-slot="playlist-item-row-select"
      className={cn('col-start-1 row-start-1 row-span-3 me-inline', className)}
      onCheckedChange={(next) => onCheckedChange(next === true)}
      {...props}
    />
  );
}

export function PlaylistItemRowBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  return (
    <div
      data-slot="playlist-item-row-body"
      className={cn('col-start-2 row-start-1 min-w-0', className)}
      {...props}
    />
  );
}

/** The adder's note on the entry, quiet, three lines at most. */
export function PlaylistItemRowNote({ className, children, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p
      data-slot="playlist-item-row-note"
      className={cn(
        'col-start-2 row-start-2 m-0 mt-1 flex min-w-0 items-start gap-1 text-body-sm text-fg-muted',
        className
      )}
      {...props}
    >
      <Icon name="edit" size="sm" className="mt-0.5" />
      <span className="line-clamp-3 min-w-0 wrap-break-word">{children}</span>
    </p>
  );
}

/** The part of the video that plays, as a finished string ("0:30 to 1:45"). */
export function PlaylistItemRowSegment({
  className,
  children,
  ...props
}: ComponentPropsWithRef<'span'>) {
  return (
    <span
      data-slot="playlist-item-row-segment"
      className={cn(
        'col-start-2 row-start-3 mt-1 inline-flex w-fit max-w-full items-center gap-1 rounded-chip bg-tint px-2 py-0.5 text-caption text-fg-muted',
        className
      )}
      {...props}
    >
      <Icon name="clip" size="sm" />
      {children}
    </span>
  );
}

export interface PlaylistItemRowAdderProps extends ComponentPropsWithRef<'span'> {
  src: string | undefined;
  name: string;
  /** The finished "Added by X": the avatar's accessible name and tooltip. */
  label: string;
}

export function PlaylistItemRowAdder({
  src,
  name,
  label,
  className,
  ...props
}: PlaylistItemRowAdderProps) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Avatar.Root
          size="xs"
          role="img"
          aria-label={label}
          tabIndex={0}
          data-slot="playlist-item-row-adder"
          className={cn('col-start-3 row-start-1 row-span-3 ms-inline focus-ring', className)}
          {...props}
        >
          {src && <Avatar.Image src={src} alt="" />}
          <Avatar.Fallback aria-hidden="true">{name.slice(0, 1)}</Avatar.Fallback>
        </Avatar.Root>
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip.Root>
  );
}
