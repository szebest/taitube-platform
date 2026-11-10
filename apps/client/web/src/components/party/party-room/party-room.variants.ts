import { tv } from '@vp/ui';
import type { PartyRoomLayout } from './types';

export const partyRoomStyles = tv({
  slots: {
    root: "grid grid-cols-1 gap-stack [grid-template-areas:'header'_'stage'_'panel']",
    header: 'flex min-w-0 flex-wrap items-center gap-inline [grid-area:header]',
    stage: 'relative min-w-0 [grid-area:stage]',
    overlay: 'pointer-events-none absolute inset-0 z-10 [&>*]:pointer-events-auto',
    panel: 'flex h-[28rem] min-h-0 min-w-0 flex-col [grid-area:panel]',
  },
  variants: {
    layout: {
      side: {
        root: "expanded:grid-cols-[minmax(0,1fr)_22.5rem] expanded:[grid-template-areas:'header_header'_'stage_panel']",
        panel: 'expanded:h-auto',
      },
      below: {},
      theater: {},
      focus: {
        root: "[grid-template-areas:'header'_'stage']",
        panel: 'hidden',
      },
    } satisfies Record<PartyRoomLayout, object>,
  },
  defaultVariants: { layout: 'side' },
});
