import { tv } from '@vp/ui';
import type { StageStatusKind, StageVariant } from './types';

export const stageStyles = tv({
  slots: {
    root: 'tw:group/stage tw:relative tw:isolate tw:w-full tw:rounded-none tw:medium:rounded-card tw:in-data-[motion=reduced]:[view-transition-name:none]',
    ground: 'tw:absolute tw:inset-0 tw:rounded-[inherit] tw:bg-media tw:shadow-3',
    glow: 'tw:pointer-events-none tw:absolute tw:-inset-[5rem] tw:-z-10 tw:hidden tw:blur-ambient tw:opacity-ambient tw:transition-opacity tw:duration-slow tw:ease-standard tw:medium:flex tw:group-data-paused/stage:opacity-[calc(var(--opacity-ambient)*0.6)] tw:in-data-[ambient=off]:hidden tw:in-data-[contrast=more]:hidden',
    glowColor: 'tw:flex-1 tw:transition-colors tw:duration-slow tw:ease-standard',
    player: 'tw:absolute tw:inset-0 tw:overflow-hidden tw:rounded-[inherit]',
    poster: 'tw:absolute tw:inset-0 tw:size-full tw:rounded-[inherit] tw:object-cover',
    statusMark:
      'tw:flex tw:size-control-lg tw:items-center tw:justify-center tw:rounded-full tw:bg-raised tw:text-fg',
    status:
      'tw:absolute tw:inset-0 tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-stack tw:rounded-[inherit] tw:p-inset-card tw:text-center tw:text-body tw:text-fg',
  },
  variants: {
    variant: {
      standard: {
        root: 'tw:aspect-video tw:max-medium:sticky tw:max-medium:top-header tw:max-medium:z-sticky',
      },
      theater: {
        root: 'tw:aspect-video tw:max-h-[80vh] tw:max-medium:sticky tw:max-medium:top-header tw:max-medium:z-sticky',
      },
      vertical: { root: 'tw:aspect-9/16 tw:rounded-card' },
      banner: { root: 'tw:min-h-full', ground: 'tw:hidden' },
    } satisfies Record<StageVariant, object>,
    kind: {
      loading: {
        status: 'tw:animate-fade-in tw:[animation-delay:400ms] tw:[animation-fill-mode:backwards]',
      },
      error: { status: 'tw:bg-surface' },
      unavailable: { status: 'tw:bg-surface tw:text-fg-muted' },
    } satisfies Record<StageStatusKind, object>,
  },
  defaultVariants: { variant: 'standard' },
});
