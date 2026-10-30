import { Icon, IconButton, Skeleton, Slot, useUiCopy } from '@vp/ui';
import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useId,
  useState,
} from 'react';

import { VideoCardSkeleton } from '#app/components/video/video-card';
import { ShelfContext, useShelf } from './shelf.context';
import { shelfStyles } from './shelf.variants';
import type { ShelfChevronSide, ShelfVariant } from './types';

const PAGE_FRACTION = 0.8;
const EDGE_TOLERANCE_PX = 1;
const SKELETON_ITEMS = 5;

interface Edges {
  atStart: boolean;
  atEnd: boolean;
  nearEnd: boolean;
}

/** Where the track's scroll stands; `scrollLeft` runs negative in a right-to-left track. */
function edgesOf(track: HTMLElement): Edges {
  const scrolled = Math.abs(track.scrollLeft);
  const remaining = track.scrollWidth - track.clientWidth - scrolled;

  return {
    atStart: scrolled <= EDGE_TOLERANCE_PX,
    atEnd: remaining <= EDGE_TOLERANCE_PX,
    nearEnd: remaining <= track.clientWidth,
  };
}

function inlineSign(track: HTMLElement, side: ShelfChevronSide): number {
  const forward = side === 'inline-end' ? 1 : -1;
  return getComputedStyle(track).direction === 'rtl' ? -forward : forward;
}

export interface ShelfRootProps extends ComponentPropsWithRef<'section'> {
  variant?: ShelfVariant;
  /** Called once the viewer has scrolled within a screen of the end, to load more. */
  onEndReached?: () => void;
}

/** A headed horizontal scroller of cards; the section is named by its `Shelf.Title`. */
export function ShelfRoot({ variant = 'card', onEndReached, className, ...props }: ShelfRootProps) {
  const titleId = useId();
  const [track, setTrack] = useState<HTMLUListElement | null>(null);
  const [edges, setEdges] = useState<Edges>({ atStart: true, atEnd: true, nearEnd: false });
  const reachEnd = useEffectEvent(() => onEndReached?.());

  useEffect(() => {
    if (track === null) {
      return;
    }

    const measure = () => setEdges(edgesOf(track));
    const resized = new ResizeObserver(measure);
    measure();
    resized.observe(track);
    track.addEventListener('scroll', measure, { passive: true });

    return () => {
      resized.disconnect();
      track.removeEventListener('scroll', measure);
    };
  }, [track]);

  useEffect(() => {
    if (edges.nearEnd) reachEnd();
  }, [edges.nearEnd]);

  const scrollBy = (side: ShelfChevronSide) => {
    if (track === null) return;
    track.scrollBy({ left: inlineSign(track, side) * track.clientWidth * PAGE_FRACTION });
  };

  return (
    <ShelfContext
      value={{
        variant,
        titleId,
        atStart: edges.atStart,
        atEnd: edges.atEnd,
        scrollBy,
        setTrack,
      }}
    >
      <section
        data-slot="shelf"
        aria-labelledby={titleId}
        className={shelfStyles({ variant }).root({ className })}
        {...props}
      />
    </ShelfContext>
  );
}

export function ShelfHeader({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { variant } = useShelf('Header');

  return (
    <div
      data-slot="shelf-header"
      className={shelfStyles({ variant }).header({ className })}
      {...props}
    />
  );
}

export interface ShelfPartProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

/** The heading that says why the shelf is here: an `h2` unless the caller passes its own with `asChild`. */
export function ShelfTitle({ asChild = false, className, ...props }: ShelfPartProps) {
  const { variant, titleId } = useShelf('Title');
  const Element = asChild ? Slot.Root : 'h2';

  return (
    <Element
      data-slot="shelf-title"
      id={titleId}
      className={shelfStyles({ variant }).title({ className })}
      {...props}
    />
  );
}

/** The curator's one line beside the heading. */
export function ShelfNote({ asChild = false, className, ...props }: ShelfPartProps) {
  const { variant } = useShelf('Note');
  const Element = asChild ? Slot.Root : 'p';

  return (
    <Element
      data-slot="shelf-note"
      className={shelfStyles({ variant }).note({ className })}
      {...props}
    />
  );
}

/** The link at the end of the heading row ("See all"), the router link passed with `asChild`. */
export function ShelfAction({ asChild = false, className, ...props }: ShelfPartProps) {
  const { variant } = useShelf('Action');
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="shelf-action"
      className={shelfStyles({ variant }).action({ className })}
      {...props}
    />
  );
}

function ShelfChevron({ side }: { side: ShelfChevronSide }) {
  const { variant, atStart, atEnd, scrollBy } = useShelf('Chevron');
  const { scrollBack, scrollForward } = useUiCopy();
  const start = side === 'inline-start';

  return (
    <IconButton
      data-slot="shelf-chevron"
      data-hidden={(start ? atStart : atEnd) || undefined}
      aria-label={start ? scrollBack : scrollForward}
      variant="outline"
      size="sm"
      className={shelfStyles({ variant, side }).chevron()}
      onClick={() => scrollBy(side)}
    >
      <Icon name={start ? 'chevron-left' : 'chevron-right'} />
    </IconButton>
  );
}

export interface ShelfTrackProps extends ComponentPropsWithRef<'ul'> {
  /** More items are loading: the caller appends a skeleton item. */
  busy?: boolean;
}

/** The scroller, its items `Shelf.Item`s; chevrons appear over its edges on pointer devices. */
export function ShelfTrack({ busy = false, className, onKeyDown, ...props }: ShelfTrackProps) {
  const { variant, titleId, setTrack } = useShelf('Track');
  const styles = shelfStyles({ variant });

  const jump = (event: KeyboardEvent<HTMLUListElement>) => {
    onKeyDown?.(event);
    const { currentTarget: track, target, key } = event;
    if (target !== track || (key !== 'Home' && key !== 'End')) return;
    event.preventDefault();
    const end = Math.max(track.scrollWidth - track.clientWidth, 0);
    const toEnd = key === 'End' ? end : 0;
    track.scrollTo({ left: getComputedStyle(track).direction === 'rtl' ? -toEnd : toEnd });
  };

  return (
    <div data-slot="shelf-viewport" className={styles.viewport()}>
      <ShelfChevron side="inline-start" />
      <ul
        data-slot="shelf-track"
        ref={setTrack}
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroller reached by keyboard, as the spec asks.
        tabIndex={0}
        className={styles.track({ className })}
        onKeyDown={jump}
        {...props}
      />
      <ShelfChevron side="inline-end" />
    </div>
  );
}

export function ShelfItem({ className, ...props }: ComponentPropsWithRef<'li'>) {
  const { variant } = useShelf('Item');

  return (
    <li
      data-slot="shelf-item"
      className={shelfStyles({ variant }).item({ className })}
      {...props}
    />
  );
}

export interface ShelfSkeletonProps {
  variant?: ShelfVariant;
}

/** The heading bar and five items of the variant, at the loaded shelf's size. */
export function ShelfSkeleton({ variant = 'card' }: ShelfSkeletonProps) {
  const styles = shelfStyles({ variant });

  return (
    <div data-slot="shelf-skeleton" aria-hidden="true" className={styles.root()}>
      <Skeleton shape="text" radius="xs" className={styles.title({ className: 'tw:w-60' })} />
      <div className={styles.track({ className: 'tw:overflow-hidden' })}>
        {variant === 'channel' ? (
          Array.from({ length: SKELETON_ITEMS }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholders with no identity of their own.
            <Skeleton key={index} shape="circle" className="tw:w-full" />
          ))
        ) : (
          <VideoCardSkeleton
            variant={variant === 'poster' ? 'poster' : 'shelf'}
            count={SKELETON_ITEMS}
          />
        )}
      </div>
    </div>
  );
}
