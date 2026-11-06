import { tv } from '@vp/ui';
import type { StageStatusKind, StageVariant } from './types';

export const stageStyles = tv({
  slots: {
    root: 'group/stage relative isolate w-full rounded-none medium:rounded-card in-data-[motion=reduced]:[view-transition-name:none]',
    ground: 'absolute inset-0 rounded-[inherit] bg-media shadow-3',
    glow: 'pointer-events-none absolute -inset-[5rem] -z-10 hidden blur-ambient opacity-ambient transition-opacity duration-slow ease-standard medium:flex group-data-paused/stage:opacity-[calc(var(--opacity-ambient)*0.6)] in-data-[ambient=off]:hidden in-data-[contrast=more]:hidden',
    glowColor: 'flex-1 transition-colors duration-slow ease-standard',
    player: 'absolute inset-0 overflow-hidden rounded-[inherit]',
    poster: 'absolute inset-0 size-full rounded-[inherit] object-cover',
    statusMark: 'flex size-control-lg items-center justify-center rounded-full bg-raised text-fg',
    status:
      'absolute inset-0 flex flex-col items-center justify-center gap-stack rounded-[inherit] p-inset-card text-center text-body text-fg',
  },
  variants: {
    variant: {
      standard: {
        root: 'aspect-video max-medium:sticky max-medium:top-header max-medium:z-sticky',
      },
      theater: {
        root: 'aspect-video max-h-[80vh] max-medium:sticky max-medium:top-header max-medium:z-sticky',
      },
      vertical: { root: 'aspect-9/16 rounded-card' },
      banner: { root: 'min-h-full', ground: 'hidden' },
    } satisfies Record<StageVariant, object>,
    kind: {
      loading: {
        status: 'animate-fade-in [animation-delay:400ms] [animation-fill-mode:backwards]',
      },
      error: { status: 'bg-surface' },
      unavailable: { status: 'bg-surface text-fg-muted' },
    } satisfies Record<StageStatusKind, object>,
  },
  defaultVariants: { variant: 'standard' },
});
