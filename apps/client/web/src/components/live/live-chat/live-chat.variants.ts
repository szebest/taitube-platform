import { tv } from '@vp/ui';
import type { LiveChatLayout, LiveChatMessageState } from './types';

export const liveChatStyles = tv({
  slots: {
    root: 'tw:group/chat tw:relative tw:flex tw:min-h-0 tw:flex-col tw:overflow-hidden tw:font-sans',
    header:
      'tw:flex tw:shrink-0 tw:items-center tw:gap-inline tw:border-b-divider tw:py-inline tw:ps-inset-card tw:pe-inline tw:text-label',
    headerTitle: 'tw:m-0 tw:min-w-0 tw:flex-1 tw:truncate tw:text-label',
    menu: 'tw:flex tw:flex-col tw:gap-stack',
    menuRow: 'tw:flex tw:items-center tw:justify-between tw:gap-stack tw:text-body-sm',
    pinned:
      'tw:flex tw:shrink-0 tw:items-start tw:gap-inline tw:bg-tint tw:px-inset-card tw:py-inline tw:text-body-sm',
    pinnedIcon: 'tw:mt-[0.125rem] tw:shrink-0 tw:text-accent-ink',
    listWrap: 'tw:relative tw:flex tw:min-h-0 tw:flex-1',
    list: 'tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:overscroll-contain tw:px-inset-card tw:py-inline tw:focus-ring',
    messages: 'tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-stack tw:p-0',
    jump: 'tw:absolute tw:inset-x-0 tw:bottom-inline tw:mx-auto tw:w-max tw:shadow-2',
    message: 'tw:flex tw:items-start tw:gap-inline',
    messageBody: 'tw:m-0 tw:min-w-0 tw:text-body-sm tw:[overflow-wrap:anywhere]',
    text: '',
    author: 'tw:me-inline tw:text-label tw:text-fg-muted',
    roleBadge: 'tw:me-inline tw:align-middle',
    failure:
      'tw:mt-inline tw:flex tw:items-center tw:gap-inline tw:text-caption tw:text-danger-ink',
    composer:
      'tw:flex tw:shrink-0 tw:flex-col tw:gap-inline tw:border-t-divider tw:px-inset-card tw:pt-inline tw:pb-inset-card',
    composerRow: 'tw:flex tw:items-end tw:gap-inline',
    input: 'tw:min-h-control-md tw:flex-1 tw:resize-none',
    composerNote: 'tw:m-0 tw:text-end tw:text-caption tw:text-fg-muted',
    ended:
      'tw:shrink-0 tw:border-t-divider tw:px-inset-card tw:py-inset-card tw:text-body-sm tw:text-fg-muted',
  },
  variants: {
    layout: {
      docked: {
        root: 'tw:h-full tw:w-full tw:rounded-card tw:border-divider tw:border-border tw:bg-surface tw:text-fg tw:medium:w-[18.75rem] tw:expanded:w-[21.25rem] tw:large:w-[23.75rem]',
        header: 'tw:border-border',
        composer: 'tw:border-border',
        ended: 'tw:border-border',
      },
      overlay: {
        root: 'tw:pointer-events-none tw:absolute tw:inset-y-0 tw:end-0 tw:w-full tw:max-w-[22.5rem] tw:bg-scrim/(--chat-opacity) tw:text-on-live tw:*:pointer-events-auto',
        header: 'tw:border-tint-strong',
        pinned: 'tw:bg-tint',
        listWrap: 'tw:pointer-events-none',
        list: 'tw:pointer-events-none',
        messages: 'tw:*:pointer-events-auto',
        author: 'tw:text-on-live',
        composer:
          'tw:border-tint-strong tw:transition-opacity tw:duration-fast tw:ease-standard tw:pointer-fine:opacity-0 tw:pointer-fine:group-hover/chat:opacity-100 tw:pointer-fine:group-focus-within/chat:opacity-100',
        ended: 'tw:border-tint-strong tw:text-on-live',
      },
    } satisfies Record<LiveChatLayout, object>,
    state: {
      sent: {},
      pending: { text: 'tw:opacity-70' },
      failed: { text: 'tw:opacity-70' },
      removed: { text: 'tw:text-fg-muted tw:italic' },
    } satisfies Record<LiveChatMessageState, object>,
  },
  defaultVariants: { layout: 'docked', state: 'sent' },
});
