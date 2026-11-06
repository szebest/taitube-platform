import { tv } from '@vp/ui';
import type { LiveLayoutChatPlace } from './types';

export const liveLayoutStyles = tv({
  slots: {
    root: "tw:grid tw:grid-cols-1 tw:gap-section tw:[grid-template-areas:'stage'_'chat'_'details']",
    stage: 'tw:min-w-0 tw:[grid-area:stage]',
    chat: 'tw:flex tw:h-[28rem] tw:min-h-0 tw:justify-center tw:[grid-area:chat] tw:expanded:h-auto',
    details: 'tw:flex tw:min-w-0 tw:flex-col tw:gap-stack tw:[grid-area:details]',
  },
  variants: {
    chat: {
      docked: {
        root: "tw:expanded:grid-cols-[minmax(0,1fr)_auto] tw:expanded:[grid-template-areas:'stage_chat'_'details_.']",
      },
      overlay: { root: "tw:[grid-template-areas:'stage'_'details']" },
    } satisfies Record<LiveLayoutChatPlace, object>,
  },
  defaultVariants: { chat: 'docked' },
});
