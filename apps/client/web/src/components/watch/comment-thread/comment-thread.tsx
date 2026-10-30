import { COMMENT_SORTS } from '@vp/domain';
import {
  Avatar,
  Button,
  Icon,
  SegmentedControl,
  Skeleton,
  Slot,
  Textarea,
  useUiCopy,
} from '@vp/ui';
import {
  type ComponentPropsWithRef,
  type KeyboardEvent,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from 'react';

import { CommentItemSkeleton } from '#app/components/discussion/comment-item';
import { CommentThreadContext, useCommentThread } from './comment-thread.context';
import { commentThreadStyles } from './comment-thread.variants';
import type { CommentThreadLayout, CommentThreadSort } from './types';

const SKELETON_ITEMS = ['first', 'second', 'third', 'fourth', 'fifth'];
const LOADING_MORE = ['first', 'second', 'third'];

const isSort = (value: string): value is CommentThreadSort =>
  (COMMENT_SORTS as readonly string[]).includes(value);

export interface CommentThreadRootProps extends ComponentPropsWithRef<'section'> {
  layout?: CommentThreadLayout;
  /** Controlled, so the caller resets it with the video. */
  sort: CommentThreadSort;
  onSortChange: (sort: CommentThreadSort) => void;
  /** Loads the next page when the end of the list scrolls into view. */
  onEndReached?: () => void;
}

/** The discussion: the heading and sort, the composer, the comments and the footer that loads more. */
export function CommentThreadRoot({
  layout = 'inline',
  sort,
  onSortChange,
  onEndReached,
  className,
  ...props
}: CommentThreadRootProps) {
  const headingId = useId();

  return (
    <CommentThreadContext
      value={{ layout, sort, setSort: onSortChange, headingId, endReached: onEndReached }}
    >
      <section
        data-slot="comment-thread"
        data-layout={layout}
        aria-labelledby={headingId}
        className={commentThreadStyles({ layout }).root({ className })}
        {...props}
      />
    </CommentThreadContext>
  );
}

export interface CommentThreadHeaderProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

/** The heading, its count finished by the caller, and the sort. */
export function CommentThreadHeader({
  asChild = false,
  className,
  children,
  ...props
}: CommentThreadHeaderProps) {
  const { sort, setSort, headingId } = useCommentThread('Header');
  const copy = useUiCopy();
  const styles = commentThreadStyles();
  const Heading = asChild ? Slot.Root : 'h2';
  const labels = { top: copy.sortTop, newest: copy.sortNewest } satisfies Record<
    CommentThreadSort,
    string
  >;

  return (
    <div data-slot="comment-thread-header" className={styles.header({ className })} {...props}>
      <Heading id={headingId} className={styles.heading()}>
        {children}
      </Heading>
      <SegmentedControl.Root
        size="sm"
        aria-label={copy.sortComments}
        value={sort}
        onValueChange={(next) => isSort(next) && setSort(next)}
      >
        {COMMENT_SORTS.map((option) => (
          <SegmentedControl.Item key={option} value={option}>
            {labels[option]}
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </div>
  );
}

export interface CommentThreadComposerProps
  extends Omit<ComponentPropsWithRef<'form'>, 'onChange' | 'onSubmit'> {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  viewerAvatar?: string;
  submitting?: boolean;
  /** Why the last post failed, in the caller's words. */
  error?: string;
}

/** One row that grows; Comment and Cancel appear on focus or once there is text. */
export function CommentThreadComposer({
  value,
  onChange,
  onSubmit,
  viewerAvatar,
  submitting = false,
  error,
  className,
  ...props
}: CommentThreadComposerProps) {
  const { layout } = useCommentThread('Composer');
  const copy = useUiCopy();
  const [focused, setFocused] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();
  const styles = commentThreadStyles({ layout });
  const open = focused || value.length > 0 || submitting;

  const submit = () => {
    if (submitting || value.trim().length === 0) return;
    onSubmit();
    field.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      submit();
    }
    if (event.key === 'Escape' && value.length === 0) {
      event.currentTarget.blur();
    }
  };

  return (
    <form
      data-slot="comment-thread-composer"
      className={styles.composer({ className })}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      {...props}
    >
      <Avatar.Root size="lg" className={styles.composerAvatar()}>
        {viewerAvatar && <Avatar.Image src={viewerAvatar} alt="" />}
        <Avatar.Fallback aria-hidden="true">
          <Icon name="you" size="sm" />
        </Avatar.Fallback>
      </Avatar.Root>
      <Textarea
        ref={field}
        autoGrow
        rows={1}
        aria-label={copy.addComment}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder={copy.addComment}
        readOnly={submitting}
        value={value}
        className={styles.composerField()}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <p id={errorId} aria-live="polite" className={styles.composerError()}>
        {error && (
          <>
            <Icon name="alert" size="sm" />
            {error}
          </>
        )}
      </p>
      {open && (
        <div className={styles.composerActions()}>
          <Button
            variant="ghost"
            disabled={submitting}
            onClick={() => {
              onChange('');
              field.current?.blur();
            }}
          >
            {copy.cancel}
          </Button>
          <Button
            type="submit"
            variant="solid"
            tone="accent"
            loading={submitting}
            disabled={value.trim().length === 0}
          >
            {copy.postComment}
          </Button>
        </div>
      )}
    </form>
  );
}

export interface CommentThreadListProps extends ComponentPropsWithRef<'ul'> {
  /** The next page is loading: three skeleton rows trail the list. */
  busy?: boolean;
}

/** The comments, pinned first in the order the caller gives them. */
export function CommentThreadList({
  busy = false,
  className,
  children,
  ...props
}: CommentThreadListProps) {
  const { layout } = useCommentThread('List');
  const styles = commentThreadStyles({ layout });

  return (
    <ul
      data-slot="comment-thread-list"
      aria-busy={busy || undefined}
      className={styles.list({ className })}
      {...props}
    >
      {children}
      {busy &&
        LOADING_MORE.map((row) => (
          <li key={row}>
            <CommentItemSkeleton />
          </li>
        ))}
    </ul>
  );
}

/** One top-level comment, a `CommentItem.Root` with its replies. */
export function CommentThreadItem({ className, ...props }: ComponentPropsWithRef<'li'>) {
  return (
    <li
      data-slot="comment-thread-item"
      className={commentThreadStyles().item({ className })}
      {...props}
    />
  );
}

function useEndSentinel(onEndReached: (() => void) | undefined) {
  const sentinel = useRef<HTMLDivElement>(null);
  const reached = useEffectEvent(() => onEndReached?.());
  const watching = onEndReached !== undefined;

  useEffect(() => {
    const node = sentinel.current;
    if (!(watching && node) || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) reached();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [watching]);

  return sentinel;
}

export interface CommentThreadMoreProps extends ComponentPropsWithRef<'button'> {
  loading?: boolean;
  asChild?: boolean;
}

/** Show more comments; with `onEndReached` on the root it also loads by itself as it scrolls into view. */
export function CommentThreadMore({
  loading = false,
  asChild = false,
  className,
  children,
  ...props
}: CommentThreadMoreProps) {
  const { endReached } = useCommentThread('More');
  const { showMoreComments } = useUiCopy();
  const sentinel = useEndSentinel(endReached);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" />
      {asChild ? (
        <Button
          asChild
          variant="soft"
          className={commentThreadStyles().more({ className })}
          {...props}
        >
          {children}
        </Button>
      ) : (
        <Button
          variant="soft"
          loading={loading}
          className={commentThreadStyles().more({ className })}
          {...props}
        >
          {children ?? showMoreComments}
        </Button>
      )}
    </>
  );
}

export function CommentThreadSkeleton() {
  const styles = commentThreadStyles();

  return (
    <div data-slot="comment-thread-skeleton" aria-hidden="true" className={styles.root()}>
      <Skeleton radius="xs" className="tw:h-[1.75rem] tw:w-[13.75rem]" />
      <div className={styles.composer()}>
        <Skeleton shape="circle" className="tw:size-avatar-lg tw:max-medium:size-avatar-md" />
        <Skeleton radius="control" className="tw:h-control-md tw:w-full" />
      </div>
      <div className="tw:flex tw:flex-col tw:gap-section">
        {SKELETON_ITEMS.map((item) => (
          <CommentItemSkeleton key={item} />
        ))}
      </div>
    </div>
  );
}
