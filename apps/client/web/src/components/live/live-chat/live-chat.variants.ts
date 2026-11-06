import { tv } from '@vp/ui';
import type { LiveChatLayout, LiveChatMessageState } from './types';

export const liveChatStyles = tv({
  slots: {
    root: 'group/chat relative flex min-h-0 flex-col overflow-hidden font-sans',
    header:
      'flex shrink-0 items-center gap-inline border-b-divider py-inline ps-inset-card pe-inline text-label',
    headerTitle: 'm-0 min-w-0 flex-1 truncate text-label',
    menu: 'flex flex-col gap-stack',
    menuRow: 'flex items-center justify-between gap-stack text-body-sm',
    pinned: 'flex shrink-0 items-start gap-inline bg-tint px-inset-card py-inline text-body-sm',
    pinnedIcon: 'mt-[0.125rem] shrink-0 text-accent-ink',
    listWrap: 'relative flex min-h-0 flex-1',
    list: 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-inset-card py-inline focus-ring',
    messages: 'm-0 flex list-none flex-col gap-stack p-0',
    jump: 'absolute inset-x-0 bottom-inline mx-auto w-max shadow-2',
    message: 'flex items-start gap-inline',
    messageBody: 'm-0 min-w-0 text-body-sm [overflow-wrap:anywhere]',
    text: '',
    author: 'me-inline text-label text-fg-muted',
    roleBadge: 'me-inline align-middle',
    failure: 'mt-inline flex items-center gap-inline text-caption text-danger-ink',
    composer:
      'flex shrink-0 flex-col gap-inline border-t-divider px-inset-card pt-inline pb-inset-card',
    composerRow: 'flex items-end gap-inline',
    input: 'min-h-control-md flex-1 resize-none',
    composerNote: 'm-0 text-end text-caption text-fg-muted',
    ended: 'shrink-0 border-t-divider px-inset-card py-inset-card text-body-sm text-fg-muted',
  },
  variants: {
    layout: {
      docked: {
        root: 'h-full w-full rounded-card border-divider border-border bg-surface text-fg medium:w-[18.75rem] expanded:w-[21.25rem] large:w-[23.75rem]',
        header: 'border-border',
        composer: 'border-border',
        ended: 'border-border',
      },
      overlay: {
        root: 'pointer-events-none absolute inset-y-0 end-0 w-full max-w-[22.5rem] bg-scrim/(--chat-opacity) text-on-live *:pointer-events-auto',
        header: 'border-tint-strong',
        pinned: 'bg-tint',
        listWrap: 'pointer-events-none',
        list: 'pointer-events-none',
        messages: '*:pointer-events-auto',
        author: 'text-on-live',
        composer:
          'border-tint-strong transition-opacity duration-fast ease-standard pointer-fine:opacity-0 pointer-fine:group-hover/chat:opacity-100 pointer-fine:group-focus-within/chat:opacity-100',
        ended: 'border-tint-strong text-on-live',
      },
    } satisfies Record<LiveChatLayout, object>,
    state: {
      sent: {},
      pending: { text: 'opacity-70' },
      failed: { text: 'opacity-70' },
      removed: { text: 'text-fg-muted italic' },
    } satisfies Record<LiveChatMessageState, object>,
  },
  defaultVariants: { layout: 'docked', state: 'sent' },
});
