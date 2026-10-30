import { tv } from '@vp/ui';
import type { VideoThumbnailAspect, VideoThumbnailRadius } from './types';

const LIVE_SHOWN = 'tw:group-has-[[data-slot=video-thumbnail-live]]/thumbnail:hidden';

export const videoThumbnailStyles = tv({
  slots: {
    root: 'tw:group/thumbnail tw:relative tw:isolate tw:block tw:w-full tw:overflow-hidden tw:bg-tint tw:after:pointer-events-none tw:after:absolute tw:after:inset-0 tw:after:rounded-[inherit] tw:after:border-divider tw:after:border-fg/8 tw:in-data-[motion=reduced]:[view-transition-name:none]',
    image:
      'tw:absolute tw:inset-0 tw:size-full tw:object-cover tw:opacity-0 tw:transition-opacity tw:duration-base tw:ease-standard tw:data-loaded:opacity-100',
    placeholder: 'tw:absolute tw:inset-0 tw:grid tw:place-items-center tw:text-fg-muted',
    badges:
      'tw:absolute tw:inset-bs-inline tw:inset-s-inline tw:flex tw:max-w-[calc(100%-2*var(--gap-inline))] tw:flex-wrap tw:gap-inline',
    live: 'tw:absolute tw:inset-bs-inline tw:inset-e-inline',
    duration: `tw:absolute tw:inset-be-inline tw:rounded-xs tw:bg-scrim tw:px-1.5 tw:py-px tw:font-mono tw:text-mono tw:text-on-live tw:tabular-nums ${LIVE_SHOWN}`,
    progress: `tw:absolute tw:inset-x-0 tw:inset-be-0 tw:h-(--border-focus) tw:rounded-none ${LIVE_SHOWN}`,
  },
  variants: {
    aspect: {
      video: { root: 'tw:aspect-[16/9]', duration: 'tw:inset-e-inline' },
      poster: { root: 'tw:aspect-[9/16]', duration: 'tw:inset-s-inline' },
    } satisfies Record<VideoThumbnailAspect, object>,
    radius: {
      thumb: { root: 'tw:rounded-thumb' },
    } satisfies Record<VideoThumbnailRadius, object>,
  },
  defaultVariants: { aspect: 'video', radius: 'thumb' },
});
