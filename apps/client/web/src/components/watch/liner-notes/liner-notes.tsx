import { Button, Chip, Skeleton, Slot, useUiCopy, VisuallyHidden } from '@vp/ui';
import { type ComponentPropsWithRef, useEffect, useId, useRef, useState } from 'react';
import { LinerNotesContext, useLinerNotes } from './liner-notes.context';
import { linerNotesStyles } from './liner-notes.variants';
import type { LinerNotesLayout } from './types';

const SKELETON_CHIPS = ['arrival', 'tram', 'rain', 'night'];

export interface LinerNotesRootProps extends ComponentPropsWithRef<'section'> {
  layout?: LinerNotesLayout;
  /** Controls the notes; without it the card keeps its own state. */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Serves every timecode and chapter. */
  onSeek: (seconds: number) => void;
}

/** The description set like an album's liner notes: the stats line, the notes, the chapters. */
export function LinerNotesRoot({
  layout = 'card',
  expanded: controlled,
  onExpandedChange,
  onSeek,
  className,
  ...props
}: LinerNotesRootProps) {
  const [own, setOwn] = useState(false);
  const bodyId = useId();
  const { description } = useUiCopy();
  const expanded = controlled ?? own;

  const setExpanded = (next: boolean) => {
    setOwn(next);
    onExpandedChange?.(next);
  };

  return (
    <LinerNotesContext value={{ layout, expanded, setExpanded, seek: onSeek, bodyId }}>
      <section
        data-slot="liner-notes"
        data-expanded={expanded || undefined}
        aria-label={description}
        className={linerNotesStyles({ layout }).root({ className })}
        {...props}
      />
    </LinerNotesContext>
  );
}

/** Views, date and tags, finished by the caller. */
export function LinerNotesMeta({ className, ...props }: ComponentPropsWithRef<'p'>) {
  return (
    <p data-slot="liner-notes-meta" className={linerNotesStyles().meta({ className })} {...props} />
  );
}

/** The notes, already tokenised by the caller: three lines until expanded, the full text always in the DOM. */
export function LinerNotesBody({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { expanded, setExpanded, bodyId } = useLinerNotes('Body');
  const { showMore, showLess } = useUiCopy();
  const styles = linerNotesStyles();

  return (
    <>
      <div
        id={bodyId}
        data-slot="liner-notes-body"
        className={styles.body({ className })}
        {...props}
      />
      <Button
        variant="ghost"
        tone="accent"
        size="sm"
        aria-expanded={expanded}
        aria-controls={bodyId}
        className={styles.toggle()}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? showLess : showMore}
      </Button>
    </>
  );
}

export interface LinerNotesTimecodeProps extends ComponentPropsWithRef<'button'> {
  seconds: number;
  asChild?: boolean;
}

/** A time in the notes that seeks the player; its text is the time, its name says so. */
export function LinerNotesTimecode({
  seconds,
  asChild = false,
  className,
  children,
  onClick,
  ...props
}: LinerNotesTimecodeProps) {
  const { seek } = useLinerNotes('Timecode');
  const { seekTo } = useUiCopy();
  const id = useId();
  const Element = asChild ? Slot.Root : 'button';

  return (
    <Element
      data-slot="liner-notes-timecode"
      type={asChild ? undefined : 'button'}
      aria-labelledby={`${id}-action ${id}-time`}
      className={linerNotesStyles().timecode({ className })}
      onClick={(event) => {
        onClick?.(event);
        seek(seconds);
      }}
      {...props}
    >
      <VisuallyHidden id={`${id}-action`}>{seekTo}</VisuallyHidden>
      <Slot.Slottable>
        <span id={`${id}-time`}>{children}</span>
      </Slot.Slottable>
    </Element>
  );
}

/** The chapter strip, a labelled list of buttons that scrolls; on compact it lists them once expanded. */
export function LinerNotesChapters({
  className,
  children,
  ...props
}: ComponentPropsWithRef<'nav'>) {
  const { chapters } = useUiCopy();

  return (
    <nav aria-label={chapters} data-slot="liner-notes-chapters" {...props}>
      <ul
        className={linerNotesStyles().chapters({ className: ['tw:m-0 tw:list-none', className] })}
      >
        {children}
      </ul>
    </nav>
  );
}

export interface LinerNotesChapterProps extends Omit<ComponentPropsWithRef<'button'>, 'id'> {
  id: string;
  seconds: number;
  /** The start, finished by the caller. */
  time: string;
  thumbnailSrc?: string;
  /** The chapter playing now: marked, and scrolled into the strip's view. */
  current?: boolean;
}

function useKeptInStrip(current: boolean) {
  const chip = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const node = chip.current;
    const strip = node?.closest('ul');
    if (!(current && node && strip)) return;

    const chipBox = node.getBoundingClientRect();
    const stripBox = strip.getBoundingClientRect();
    const reduced = document.documentElement.dataset.motion === 'reduced';
    strip.scrollBy?.({
      left: chipBox.left + chipBox.width / 2 - (stripBox.left + stripBox.width / 2),
      behavior: reduced ? 'instant' : 'smooth',
    });
  }, [current]);

  return chip;
}

export function LinerNotesChapter({
  id,
  seconds,
  time,
  thumbnailSrc,
  current = false,
  className,
  children,
  onClick,
  ...props
}: LinerNotesChapterProps) {
  const { seek } = useLinerNotes('Chapter');
  const chip = useKeptInStrip(current);
  const styles = linerNotesStyles();

  return (
    <li data-chapter={id} className="tw:flex">
      <Chip
        ref={chip}
        variant="outline"
        aria-current={current || undefined}
        className={styles.chapter({ className })}
        onClick={(event) => {
          onClick?.(event);
          seek(seconds);
        }}
        {...props}
      >
        {thumbnailSrc && <img src={thumbnailSrc} alt="" className={styles.chapterThumb()} />}
        <span className={styles.chapterLabel()}>
          <span className={styles.chapterTime()}>{time}</span> {children}
        </span>
      </Chip>
    </li>
  );
}

export function LinerNotesSkeleton({ layout = 'card' }: { layout?: LinerNotesLayout }) {
  const styles = linerNotesStyles({ layout });

  return (
    <div
      data-slot="liner-notes-skeleton"
      aria-hidden="true"
      className={styles.root({ className: 'tw:min-h-[9.25rem]' })}
    >
      <Skeleton radius="xs" className="tw:h-[1.25rem] tw:w-[13.75rem]" />
      <Skeleton radius="xs" className="tw:h-[1.4375rem] tw:w-full" />
      <Skeleton radius="xs" className="tw:h-[1.4375rem] tw:w-full" />
      <Skeleton radius="xs" className="tw:h-[1.4375rem] tw:w-[64%]" />
      <div className="tw:flex tw:gap-inline tw:overflow-hidden">
        {SKELETON_CHIPS.map((chip) => (
          <Skeleton key={chip} radius="chip" className="tw:h-control-sm tw:w-[7rem] tw:shrink-0" />
        ))}
      </div>
    </div>
  );
}
