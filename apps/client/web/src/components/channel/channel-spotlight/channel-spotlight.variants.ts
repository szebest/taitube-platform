import { tv } from '@vp/ui';
import type { ChannelSpotlightSource } from './types';

export const channelSpotlightStyles = tv({
  slots: {
    root: 'relative isolate animate-fade-in rounded-card bg-surface p-inset-card font-sans text-fg [animation-duration:var(--duration-base)] medium:[&_[data-slot=video-card-thumb]]:max-w-[30rem] expanded:[&_[data-slot=video-card-thumb]]:max-w-[40rem] expanded:[&_[data-slot=video-card]]:grid-cols-[minmax(0,40rem)_minmax(0,1fr)] expanded:[&_[data-slot=video-card]]:grid-rows-[repeat(5,auto)_minmax(0,1fr)] expanded:[&_[data-slot=video-card]]:gap-x-section expanded:[&_[data-slot=video-card]]:gap-y-0 expanded:[&_[data-slot=video-card]>*]:col-start-2 expanded:[&_[data-slot=video-card]>*]:mb-inline expanded:[&_[data-slot=video-card]>[data-slot=video-card-thumb]]:col-start-1 expanded:[&_[data-slot=video-card]>[data-slot=video-card-thumb]]:row-[1/-1] expanded:[&_[data-slot=video-card]>[data-slot=video-card-thumb]]:mb-0',
    kicker: 'm-0 text-overline text-accent-ink uppercase',
    actions:
      'relative z-lift flex flex-wrap items-center gap-inline max-medium:[&>[data-slot=button]]:flex-1',
  },
  variants: {
    source: {
      trailer: {},
      returning: { root: 'shadow-[inset_4px_0_0_0_var(--accent)]' },
    } satisfies Record<ChannelSpotlightSource, object>,
  },
  defaultVariants: { source: 'trailer' },
});
