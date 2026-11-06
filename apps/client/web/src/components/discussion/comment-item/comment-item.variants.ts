import { tv } from '@vp/ui';
import type { CommentAvatarSize, CommentLevel, CommentState } from './types';

export const COMMENT_AVATAR = {
  comment: 'lg',
  reply: 'sm',
} as const satisfies Record<CommentLevel, CommentAvatarSize>;

export const commentItemStyles = tv({
  slots: {
    root: 'group/comment grid grid-cols-[auto_minmax(0,1fr)] gap-x-stack gap-y-1 text-fg has-[[data-slot=comment-item-pinned]]:border-s-[length:var(--border-focus)] has-[[data-slot=comment-item-pinned]]:border-accent-soft has-[[data-slot=comment-item-pinned]]:ps-stack',
    avatar: 'row-span-6',
    pinned: 'col-start-2 m-0 text-overline text-accent-ink uppercase',
    header: 'col-start-2 flex flex-wrap items-center gap-x-inline gap-y-1',
    author: 'text-label text-fg',
    time: 'text-caption text-fg-muted no-underline hover:underline focus-ring rounded-xs',
    edited: 'text-caption text-fg-muted',
    body: 'col-start-2 m-0 max-w-reading-max text-body break-words whitespace-pre-line [&_a]:text-accent-ink [&_a]:underline',
    clamp: 'line-clamp-6',
    gone: 'col-start-2 m-0 text-body text-fg-muted italic',
    actions: 'col-start-2 -ms-inline flex flex-wrap items-center gap-1',
    menu: 'ms-auto',
    count: 'font-mono text-mono',
    timecode:
      'inline cursor-pointer rounded-xs border-0 bg-transparent p-0 font-mono text-mono text-accent-ink hover:underline focus-ring',
    failed: 'col-start-2 flex flex-wrap items-center gap-inline text-caption text-danger-ink',
    replies: 'col-start-2 flex flex-col items-start gap-stack',
    repliesList: 'm-0 flex w-full list-none flex-col gap-stack p-0 motion-safe:animate-fade-in',
  },
  variants: {
    state: {
      view: {},
      editing: {},
      pending: { body: 'opacity-70' },
      failed: {},
      deleted: {},
      removed: {},
    } satisfies Record<CommentState, object>,
  },
  defaultVariants: { state: 'view' },
});
