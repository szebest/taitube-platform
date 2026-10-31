import { Skeleton, Slot, useUiCopy } from '@vp/ui';
import type { ComponentPropsWithRef } from 'react';

import {
  Shelf,
  type ShelfPartProps,
  type ShelfRootProps,
  type ShelfTrackProps,
  shelfStyles,
} from '../shelf';
import { VideoCardSkeleton } from '../video-card';
import { StartHereShelfContext, useStartHereShelf } from './start-here-shelf.context';
import { startHereShelfStyles } from './start-here-shelf.variants';
import type { StartHereSource } from './types';

const SKELETON_CARDS = 5;

export interface StartHereShelfRootProps extends Omit<ShelfRootProps, 'variant'> {
  /** Drives the copy and the numbering only; the wrapper decides which videos come in. */
  source: StartHereSource;
}

/** Where a newcomer begins on a channel: the creator's pins in their order, or the most-viewed uploads. */
export function StartHereShelfRoot({ source, ...props }: StartHereShelfRootProps) {
  return (
    <StartHereShelfContext value={{ source, numbered: source === 'pinned' }}>
      <Shelf.Root data-source={source} variant="card" {...props} />
    </StartHereShelfContext>
  );
}

export function StartHereShelfHeader({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { source } = useStartHereShelf('Header');

  return (
    <Shelf.Header className={startHereShelfStyles({ source }).header({ className })} {...props} />
  );
}

/** The shelf's heading, worded by the source: "Start here" over pins, "Most watched" otherwise. */
export function StartHereShelfKicker({ className, children, ...props }: ShelfPartProps) {
  const { source } = useStartHereShelf('Kicker');
  const { startHere, mostWatched } = useUiCopy();

  return (
    <Shelf.Title className={startHereShelfStyles({ source }).kicker({ className })} {...props}>
      <Slot.Slottable>{children}</Slot.Slottable>
      {source === 'pinned' ? startHere : mostWatched}
    </Shelf.Title>
  );
}

/** The creator's own line under the kicker, rendered as text; only pins carry one. */
export function StartHereShelfNote({ className, ...props }: ShelfPartProps) {
  const { source } = useStartHereShelf('Note');

  if (source !== 'pinned') {
    return null;
  }

  return <Shelf.Note className={startHereShelfStyles({ source }).note({ className })} {...props} />;
}

export function StartHereShelfTrack({ className, ...props }: ShelfTrackProps) {
  const { source } = useStartHereShelf('Track');

  return (
    <Shelf.Track className={startHereShelfStyles({ source }).track({ className })} {...props} />
  );
}

export interface StartHereShelfItemProps extends ComponentPropsWithRef<'li'> {
  /** The card's place in the creator's order, finished by the wrapper; shown over pins only. */
  position?: string;
}

export function StartHereShelfItem({
  position,
  className,
  children,
  ...props
}: StartHereShelfItemProps) {
  const { source, numbered } = useStartHereShelf('Item');
  const styles = startHereShelfStyles({ source });

  return (
    <Shelf.Item className={styles.item({ className })} {...props}>
      {numbered && position !== undefined && (
        <span data-slot="start-here-shelf-position" className={styles.position()}>
          {position}
        </span>
      )}
      {children}
    </Shelf.Item>
  );
}

/** The row under the track: the attribution, then the caller's "See all" (`Shelf.Action`). */
export function StartHereShelfFooter({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { source } = useStartHereShelf('Footer');

  return (
    <div
      data-slot="start-here-shelf-footer"
      className={startHereShelfStyles({ source }).footer({ className })}
      {...props}
    />
  );
}

/** Who chose these, worded by the source, as text. */
export function StartHereShelfAttribution({
  asChild = false,
  className,
  children,
  ...props
}: ShelfPartProps) {
  const { source } = useStartHereShelf('Attribution');
  const { pinnedByCreator, mostViewed } = useUiCopy();
  const Element = asChild ? Slot.Root : 'p';

  return (
    <Element
      data-slot="start-here-shelf-attribution"
      className={startHereShelfStyles({ source }).attribution({ className })}
      {...props}
    >
      <Slot.Slottable>{children}</Slot.Slottable>
      {source === 'pinned' ? pinnedByCreator : mostViewed}
    </Element>
  );
}

export function StartHereShelfSkeleton() {
  const shelf = shelfStyles({ variant: 'card' });

  return (
    <div data-slot="start-here-shelf-skeleton" aria-hidden="true" className={shelf.root()}>
      <div className="tw:flex tw:flex-col tw:gap-1">
        <Skeleton shape="text" radius="xs" className="tw:w-[5.5rem] tw:text-overline" />
        <Skeleton
          shape="text"
          radius="xs"
          className="tw:w-[20rem] tw:max-w-full tw:text-editorial"
        />
      </div>
      <div className={shelf.track({ className: 'tw:overflow-hidden' })}>
        <VideoCardSkeleton variant="shelf" count={SKELETON_CARDS} />
      </div>
    </div>
  );
}
