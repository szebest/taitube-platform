import { tv } from '@vp/ui';
import type { CommentAvatarSize, CommentLevel, CommentState } from './types';

export const COMMENT_AVATAR = {
  comment: 'lg',
  reply: 'sm',
} as const satisfies Record<CommentLevel, CommentAvatarSize>;

export const commentItemStyles = tv({
  slots: {
    root: 'tw:group/comment tw:grid tw:grid-cols-[auto_minmax(0,1fr)] tw:gap-x-stack tw:gap-y-1 tw:text-fg tw:has-[[data-slot=comment-item-pinned]]:border-s-[length:var(--border-focus)] tw:has-[[data-slot=comment-item-pinned]]:border-accent-soft tw:has-[[data-slot=comment-item-pinned]]:ps-stack',
    avatar: 'tw:row-span-6',
    pinned: 'tw:col-start-2 tw:m-0 tw:text-overline tw:text-accent-ink tw:uppercase',
    header: 'tw:col-start-2 tw:flex tw:flex-wrap tw:items-center tw:gap-x-inline tw:gap-y-1',
    author: 'tw:text-label tw:text-fg',
    time: 'tw:text-caption tw:text-fg-muted tw:no-underline tw:hover:underline tw:focus-ring tw:rounded-xs',
    edited: 'tw:text-caption tw:text-fg-muted',
    body: 'tw:col-start-2 tw:m-0 tw:max-w-reading-max tw:text-body tw:break-words tw:whitespace-pre-line tw:[&_a]:text-accent-ink tw:[&_a]:underline',
    clamp: 'tw:line-clamp-6',
    gone: 'tw:col-start-2 tw:m-0 tw:text-body tw:text-fg-muted tw:italic',
    actions: 'tw:col-start-2 tw:-ms-inline tw:flex tw:flex-wrap tw:items-center tw:gap-1',
    menu: 'tw:ms-auto',
    count: 'tw:font-mono tw:text-mono',
    timecode:
      'tw:inline tw:cursor-pointer tw:rounded-xs tw:border-0 tw:bg-transparent tw:p-0 tw:font-mono tw:text-mono tw:text-accent-ink tw:hover:underline tw:focus-ring',
    failed:
      'tw:col-start-2 tw:flex tw:flex-wrap tw:items-center tw:gap-inline tw:text-caption tw:text-danger-ink',
    replies: 'tw:col-start-2 tw:flex tw:flex-col tw:items-start tw:gap-stack',
    repliesList:
      'tw:m-0 tw:flex tw:w-full tw:list-none tw:flex-col tw:gap-stack tw:p-0 tw:motion-safe:animate-fade-in',
  },
  variants: {
    state: {
      view: {},
      editing: {},
      pending: { body: 'tw:opacity-70' },
      failed: {},
      deleted: {},
      removed: {},
    } satisfies Record<CommentState, object>,
  },
  defaultVariants: { state: 'view' },
});
