import { tv } from '@vp/ui';
import type { LiveLayoutChatPlace } from './types';

export const liveLayoutStyles = tv({
  slots: {
    root: "grid grid-cols-1 gap-section [grid-template-areas:'stage'_'chat'_'details']",
    stage: 'min-w-0 [grid-area:stage]',
    chat: 'flex h-[28rem] min-h-0 justify-center [grid-area:chat] expanded:h-auto',
    details: 'flex min-w-0 flex-col gap-stack [grid-area:details]',
  },
  variants: {
    chat: {
      docked: {
        root: "expanded:grid-cols-[minmax(0,1fr)_auto] expanded:[grid-template-areas:'stage_chat'_'details_.']",
      },
      overlay: { root: "[grid-template-areas:'stage'_'details']" },
    } satisfies Record<LiveLayoutChatPlace, object>,
  },
  defaultVariants: { chat: 'docked' },
});
