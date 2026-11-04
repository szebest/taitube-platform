import { tv } from '@vp/ui';
import type { VideoThumbnailAspect, VideoThumbnailRadius } from './types';

const LIVE_SHOWN = 'group-has-[[data-slot=video-thumbnail-live]]/thumbnail:hidden';

export const videoThumbnailStyles = tv({
  slots: {
    root: 'group/thumbnail relative isolate block w-full overflow-hidden bg-tint after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:border-divider after:border-fg/8 in-data-[motion=reduced]:[view-transition-name:none]',
    image:
      'absolute inset-0 size-full object-cover opacity-0 transition-opacity duration-base ease-standard data-loaded:opacity-100',
    placeholder: 'absolute inset-0 grid place-items-center text-fg-muted',
    badges:
      'absolute inset-bs-inline inset-s-inline flex max-w-[calc(100%-2*var(--gap-inline))] flex-wrap gap-inline',
    live: 'absolute inset-bs-inline inset-e-inline',
    duration: `absolute inset-be-inline rounded-xs bg-scrim px-1.5 py-px font-mono text-mono text-on-live tabular-nums ${LIVE_SHOWN}`,
    progress: `absolute inset-x-0 inset-be-0 h-(--border-focus) rounded-none ${LIVE_SHOWN}`,
  },
  variants: {
    aspect: {
      video: { root: 'aspect-[16/9]', duration: 'inset-e-inline' },
      poster: { root: 'aspect-[9/16]', duration: 'inset-s-inline' },
    } satisfies Record<VideoThumbnailAspect, object>,
    radius: {
      thumb: { root: 'rounded-thumb' },
    } satisfies Record<VideoThumbnailRadius, object>,
  },
  defaultVariants: { aspect: 'video', radius: 'thumb' },
});
