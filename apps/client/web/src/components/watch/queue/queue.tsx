import { VideoCardSkeleton } from '@vp/components';
import {
  Button,
  cn,
  Drawer,
  Icon,
  IconButton,
  Skeleton,
  Slot,
  SortableList,
  useUiCopy,
} from '@vp/ui';
import {
  Children,
  type ComponentPropsWithRef,
  type KeyboardEvent,
  type ReactNode,
  useId,
} from 'react';
import { QueueContext, useQueue } from './queue.context';
import { queueStyles } from './queue.variants';
import type { QueueLayout, QueueRepeat } from './types';

const NEXT_REPEAT = { off: 'all', all: 'one', one: 'off' } satisfies Record<
  QueueRepeat,
  QueueRepeat
>;

/** The one item a drop moved, and where it landed, from the order before and after. */
function moved(before: readonly string[], after: readonly string[]) {
  const first = before.findIndex((id, index) => after[index] !== id);
  const last = before.findLastIndex((id, index) => after[index] !== id);
  if (first < 0) return undefined;

  const down = after[last] === before[first];
  return down
    ? { id: before[first] as string, toIndex: last }
    : { id: before[last] as string, toIndex: first };
}

export interface QueueRootProps extends Omit<ComponentPropsWithRef<'section'>, 'onSelect'> {
  currentId: string;
  /** Follows the breakpoint when omitted: beside the stage from expanded, below it under that. */
  layout?: QueueLayout;
  /** Under the medium breakpoint the queue sits in a drawer, picked by CSS so the server markup already fits. */
  collapsible?: boolean;
  onReorder: (id: string, toIndex: number) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
}

/** The viewer's up next list, reorderable, with the current item marked; `sheet` puts it in a drawer. */
export function QueueRoot({
  currentId,
  layout,
  collapsible = false,
  onReorder,
  onRemove,
  onSelect,
  className,
  ...props
}: QueueRootProps) {
  const headingId = useId();
  const { queue } = useUiCopy();
  const sheet = layout === 'sheet';
  const drawered = sheet || collapsible;
  const section = (sectionLayout: QueueLayout | undefined, sectionClassName?: string) => (
    <section
      data-slot="queue"
      data-layout={sectionLayout}
      aria-labelledby={headingId}
      className={queueStyles({ layout: sectionLayout ?? 'auto' }).root({
        className: cn(sectionClassName, className),
      })}
      {...props}
    />
  );
  const drawer = (
    <Drawer.Root>
      <Drawer.Trigger asChild>
        <Button variant="soft" shape="pill" className={cn(collapsible && 'tw:medium:hidden')}>
          <Icon name="playlist" />
          {queue}
        </Button>
      </Drawer.Trigger>
      <Drawer.Content aria-describedby={undefined}>
        <Drawer.Title className="tw:sr-only">{queue}</Drawer.Title>
        <Drawer.Body>{section('sheet')}</Drawer.Body>
      </Drawer.Content>
    </Drawer.Root>
  );

  return (
    <QueueContext
      value={{
        currentId,
        layout,
        select: onSelect,
        remove: onRemove,
        reorder: onReorder,
        headingId,
      }}
    >
      {drawered && drawer}
      {!sheet && section(layout, collapsible ? 'tw:max-medium:hidden' : undefined)}
    </QueueContext>
  );
}

export interface QueueHeaderProps extends ComponentPropsWithRef<'div'> {
  /** Where the current item sits, finished by the caller ("3 / 12"). */
  position?: string;
  /** The modes, at the end of the row. */
  modes?: ReactNode;
  asChild?: boolean;
}

/** The queue's name, its position and the modes. */
export function QueueHeader({
  position,
  modes,
  asChild = false,
  className,
  children,
  ...props
}: QueueHeaderProps) {
  const { headingId } = useQueue('Header');
  const styles = queueStyles();
  const Heading = asChild ? Slot.Root : 'h2';

  return (
    <div data-slot="queue-header" className={styles.header({ className })} {...props}>
      <div className="tw:flex tw:min-w-0 tw:flex-col">
        <Heading id={headingId} className={styles.heading()}>
          {children}
        </Heading>
        {position && <span className={styles.position()}>{position}</span>}
      </div>
      {modes}
    </div>
  );
}

export interface QueueModesState {
  shuffle: boolean;
  repeat: QueueRepeat;
  autoplay: boolean;
}

export interface QueueModesProps extends QueueModesState {
  onChange: (next: QueueModesState) => void;
}

/** Shuffle, repeat and autoplay as toggles; repeat cycles off, all, one and its name says which. */
export function QueueModes({ shuffle, repeat, autoplay, onChange }: QueueModesProps) {
  const copy = useUiCopy();
  const state = { shuffle, repeat, autoplay };
  const repeatLabel = {
    off: copy.repeatOff,
    all: copy.repeatAll,
    one: copy.repeatOne,
  } satisfies Record<QueueRepeat, string>;

  return (
    <fieldset aria-label={copy.playbackModes} className={queueStyles().modes()}>
      <IconButton
        size="sm"
        aria-label={copy.shuffle}
        aria-pressed={shuffle}
        onClick={() => onChange({ ...state, shuffle: !shuffle })}
      >
        <Icon name="shuffle" />
      </IconButton>
      <IconButton
        size="sm"
        aria-label={repeatLabel[repeat]}
        aria-pressed={repeat !== 'off'}
        data-repeat={repeat}
        onClick={() => onChange({ ...state, repeat: NEXT_REPEAT[repeat] })}
      >
        <Icon name="repeat" />
      </IconButton>
      <IconButton
        size="sm"
        aria-label={copy.autoplay}
        aria-pressed={autoplay}
        onClick={() => onChange({ ...state, autoplay: !autoplay })}
      >
        <Icon name="play" />
      </IconButton>
    </fieldset>
  );
}

export interface QueueListProps extends Omit<ComponentPropsWithRef<'ul'>, 'children'> {
  /** The ids in queue order, the same order as the items. */
  items: readonly string[];
  children: ReactNode;
}

/** The reorderable list: drag a handle, or focus it, Space, arrows, Space; a single item has no handle. */
export function QueueList({ items, className, ...props }: QueueListProps) {
  const { reorder, headingId } = useQueue('List');

  return (
    <SortableList.Root
      items={items}
      aria-labelledby={headingId}
      aria-disabled={items.length < 2 || undefined}
      className={queueStyles().list({ className })}
      onReorder={(next) => {
        const move = moved(items, next);
        if (move) reorder(move.id, move.toIndex);
      }}
      {...props}
    />
  );
}

export interface QueueItemProps extends ComponentPropsWithRef<'li'> {
  id: string;
  /** The video's title: the name the handle, the remove button and the announcements use. */
  title: string;
}

/** One queued video: the handle, the row card the caller passes, the remove button. */
export function QueueItem({ id, title, className, children, onKeyDown, ...props }: QueueItemProps) {
  const { currentId, select, remove } = useQueue('Item');
  const copy = useUiCopy();
  const styles = queueStyles();
  const current = id === currentId;

  const onKey = (event: KeyboardEvent<HTMLLIElement>) => {
    onKeyDown?.(event);
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter') select(id);
    if (event.key === 'Delete') {
      const next =
        event.currentTarget.nextElementSibling ?? event.currentTarget.previousElementSibling;
      remove(id);
      if (next instanceof HTMLElement) next.focus();
    }
  };

  return (
    <SortableList.Item
      id={id}
      aria-label={title}
      aria-current={current || undefined}
      tabIndex={0}
      data-slot="queue-item"
      className={styles.item({ className })}
      onKeyDown={onKey}
      {...props}
    >
      <SortableList.Handle />
      <div className={styles.itemBody()}>
        {current && <p className={styles.nowPlaying()}>{copy.nowPlaying}</p>}
        {children}
      </div>
      <IconButton
        size="sm"
        aria-label={copy.removeFromQueue.replace('{name}', title)}
        onClick={() => remove(id)}
      >
        <Icon name="close" />
      </IconButton>
    </SortableList.Item>
  );
}

export interface QueueRecommendationsProps
  extends Omit<ComponentPropsWithRef<'section'>, 'children'> {
  /** The caller's words for the list, "More like this". */
  heading: ReactNode;
  /** Three row skeletons stand in while the list loads. */
  loading?: boolean;
  /** Row cards, each with the reason "Recommended". */
  children?: ReactNode;
}

/** A second labelled list below the queue, never confused with it. */
export function QueueRecommendations({
  heading,
  loading = false,
  className,
  children,
  ...props
}: QueueRecommendationsProps) {
  const headingId = useId();
  const styles = queueStyles();

  return (
    <section
      data-slot="queue-recommendations"
      aria-labelledby={headingId}
      aria-busy={loading || undefined}
      className={styles.recommendations({ className })}
      {...props}
    >
      <h3 id={headingId} className={styles.recommendationsHeading()}>
        {heading}
      </h3>
      {loading ? (
        <VideoCardSkeleton variant="row" size="sm" count={3} />
      ) : (
        <ul className={styles.recommendationsList()}>
          {Children.map(children, (card) => (
            <li>{card}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

const SKELETON_ROWS = ['first', 'second', 'third', 'fourth', 'fifth'];

export function QueueSkeleton({ layout }: { layout?: QueueLayout }) {
  const styles = queueStyles({ layout: layout ?? 'auto' });

  return (
    <div data-slot="queue-skeleton" aria-hidden="true" className={styles.root()}>
      <Skeleton radius="xs" className="tw:h-[1.75rem] tw:w-[10rem]" />
      <div className="tw:flex tw:flex-col tw:gap-1">
        {SKELETON_ROWS.map((row) => (
          <div key={row} className="tw:flex tw:h-[4.75rem] tw:items-center tw:gap-inline">
            <Skeleton radius="thumb" className="tw:h-[4.21875rem] tw:w-[7.5rem] tw:shrink-0" />
            <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-inline">
              <Skeleton radius="xs" className="tw:h-[1rem] tw:w-full" />
              <Skeleton radius="xs" className="tw:h-[1rem] tw:w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
