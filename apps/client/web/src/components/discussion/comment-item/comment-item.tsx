import {
  Avatar,
  Badge,
  Button,
  DropdownMenu,
  Icon,
  IconButton,
  Slot,
  Spinner,
  useUiCopy,
  VisuallyHidden,
} from '@vp/ui';
import { type ComponentPropsWithRef, type ReactElement, type ReactNode, useId } from 'react';

import { RollingCount } from '#app/components/watch/engagement-bar';
import { CommentItemContext, useCommentItem } from './comment-item.context';
import { COMMENT_AVATAR, commentItemStyles } from './comment-item.variants';
import type { CommentLevel, CommentReaction, CommentState } from './types';

export interface CommentItemRootProps extends ComponentPropsWithRef<'article'> {
  /** A reply has a smaller avatar and no replies of its own. */
  level?: CommentLevel;
  state?: CommentState;
}

/** One comment: the author, the text the app tokenised, and the actions the app passes. */
export function CommentItemRoot({
  level = 'comment',
  state = 'view',
  className,
  ...props
}: CommentItemRootProps) {
  const id = useId();
  const authorId = `${id}-author`;
  const timeId = `${id}-time`;

  return (
    <CommentItemContext value={{ level, state, authorId, timeId }}>
      <article
        data-slot="comment-item"
        data-level={level}
        data-state={state}
        aria-labelledby={`${authorId} ${timeId}`}
        className={commentItemStyles().root({ className })}
        {...props}
      />
    </CommentItemContext>
  );
}

/** The pin label above the author; its presence also draws the pinned edge. */
export function CommentItemPinned({ className, ...props }: ComponentPropsWithRef<'p'>) {
  const { pinnedByCreator } = useUiCopy();

  return (
    <p
      data-slot="comment-item-pinned"
      className={commentItemStyles().pinned({ className })}
      {...props}
    >
      {pinnedByCreator}
    </p>
  );
}

export interface CommentItemAuthorProps extends Omit<ComponentPropsWithRef<'div'>, 'children'> {
  name: string;
  avatarSrc?: string;
  /** When it was posted, finished by the app. */
  time: string;
  dateTime: string;
  /** The author owns the video. */
  creator?: boolean;
  edited?: boolean;
  /** The link to the comment's permalink, drawn around the time. */
  children?: ReactElement;
}

export function CommentItemAuthor({
  name,
  avatarSrc,
  time,
  dateTime,
  creator = false,
  edited = false,
  className,
  children,
  ...props
}: CommentItemAuthorProps) {
  const { level, state, authorId, timeId } = useCommentItem('Author');
  const copy = useUiCopy();
  const styles = commentItemStyles();
  const stamp = (
    <time id={timeId} dateTime={dateTime}>
      {time}
    </time>
  );

  return (
    <>
      <Avatar.Root
        size={COMMENT_AVATAR[level]}
        className={styles.avatar({
          className: level === 'comment' && 'tw:max-medium:size-avatar-md',
        })}
      >
        {avatarSrc && <Avatar.Image src={avatarSrc} alt="" />}
        <Avatar.Fallback aria-hidden="true">{name.slice(0, 1)}</Avatar.Fallback>
      </Avatar.Root>
      <div data-slot="comment-item-author" className={styles.header({ className })} {...props}>
        <span id={authorId} className={styles.author()}>
          {name}
        </span>
        {creator && (
          <Badge size="sm" tone="accent">
            {copy.roleCreator}
          </Badge>
        )}
        {state === 'pending' ? (
          <span aria-hidden="true" className={styles.time()}>
            <Spinner size="sm">{copy.messagePending}</Spinner>
          </span>
        ) : children ? (
          <Slot.Root className={styles.time()}>
            <Slot.Slottable>{children}</Slot.Slottable>
            {stamp}
          </Slot.Root>
        ) : (
          <span className={styles.time()}>{stamp}</span>
        )}
        {state === 'pending' && <VisuallyHidden>{stamp}</VisuallyHidden>}
        {edited && <span className={styles.edited()}>{copy.edited}</span>}
      </div>
    </>
  );
}

export interface CommentItemTimecodeProps extends ComponentPropsWithRef<'button'> {
  seconds: number;
  onSeek: (seconds: number) => void;
}

/** A time in the text that seeks the player. */
export function CommentItemTimecode({
  seconds,
  onSeek,
  className,
  children,
  ...props
}: CommentItemTimecodeProps) {
  const { seekTo } = useUiCopy();
  const id = useId();

  return (
    <button
      type="button"
      data-slot="comment-item-timecode"
      aria-labelledby={`${id}-action ${id}-time`}
      className={commentItemStyles().timecode({ className })}
      onClick={() => onSeek(seconds)}
      {...props}
    >
      <VisuallyHidden id={`${id}-action`}>{seekTo}</VisuallyHidden>
      <span id={`${id}-time`}>{children}</span>
    </button>
  );
}

/** The row under the text, hidden while editing or once the comment is gone. */
export function CommentItemActions({ className, ...props }: ComponentPropsWithRef<'div'>) {
  const { state } = useCommentItem('Actions');

  if (state !== 'view') return null;

  return (
    <div
      data-slot="comment-item-actions"
      className={commentItemStyles().actions({ className })}
      {...props}
    />
  );
}

export interface CommentItemReactionsProps {
  value: CommentReaction;
  /** The like count, formatted by the app. */
  likes: string;
  onChange: (next: CommentReaction) => void;
}

export function CommentItemReactions({ value, likes, onChange }: CommentItemReactionsProps) {
  const { like, dislike } = useUiCopy();
  const styles = commentItemStyles();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`${like} ${likes}`}
        aria-pressed={value === 'LIKE'}
        onClick={() => onChange(value === 'LIKE' ? null : 'LIKE')}
      >
        <Icon name="like" />
        <RollingCount value={likes} className={styles.count()} />
      </Button>
      <IconButton
        size="sm"
        aria-label={dislike}
        aria-pressed={value === 'DISLIKE'}
        onClick={() => onChange(value === 'DISLIKE' ? null : 'DISLIKE')}
      >
        <Icon name="dislike" />
      </IconButton>
    </>
  );
}

export function CommentItemReply(props: Omit<ComponentPropsWithRef<'button'>, 'children'>) {
  const { reply } = useUiCopy();

  return (
    <Button variant="ghost" size="sm" {...props}>
      {reply}
    </Button>
  );
}

export interface CommentItemMenuProps {
  /** `DropdownMenu.Item`s for the actions the app allows: edit, delete, report. */
  children: ReactNode;
}

export function CommentItemMenu({ children }: CommentItemMenuProps) {
  const { moreActions } = useUiCopy();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <IconButton size="sm" aria-label={moreActions} className={commentItemStyles().menu()}>
          <Icon name="more" />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">{children}</DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}

export interface CommentItemFailedProps {
  onRetry: () => void;
  onDelete: () => void;
}

/** Shown for the `failed` state: the comment was not posted. */
export function CommentItemFailed({ onRetry, onDelete }: CommentItemFailedProps) {
  const { state } = useCommentItem('Failed');
  const copy = useUiCopy();

  if (state !== 'failed') return null;

  return (
    <div data-slot="comment-item-failed" className={commentItemStyles().failed()}>
      <Icon name="alert" size="sm" />
      <span>{copy.notPosted}</span>
      <Button variant="ghost" tone="accent" size="sm" onClick={onRetry}>
        {copy.retry}
      </Button>
      <Button variant="ghost" tone="danger" size="sm" onClick={onDelete}>
        {copy.delete}
      </Button>
    </div>
  );
}
