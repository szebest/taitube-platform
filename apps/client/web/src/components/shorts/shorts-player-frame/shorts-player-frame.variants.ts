import { tv } from '@vp/ui';
import type { ShortsActionsLayout } from './types';

export const shortsPlayerFrameStyles = tv({
  slots: {
    root: 'relative flex w-full items-end justify-center font-sans text-fg',
    nav: 'hidden flex-col gap-stack self-center pointer-fine:flex',
    frame:
      'relative isolate overflow-hidden rounded-card bg-media text-on-live shadow-3 after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-[45%] after:bg-linear-to-b after:from-transparent after:to-scrim after:content-[""] data-[enter=next]:animate-slide-in-from-bottom data-[enter=previous]:animate-slide-in-from-top motion-reduce:animate-none in-data-[motion=reduced]:animate-none data-[state=empty]:bg-surface data-[state=empty]:text-fg data-[state=empty]:shadow-none data-[state=empty]:after:hidden',
    media: 'absolute inset-0 *:size-full *:object-cover',
    surface:
      'absolute inset-0 z-[1] flex cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-on-live focus-ring',
    paused: 'flex size-[4rem] items-center justify-center rounded-full bg-scrim animate-fade-in',
    muted: 'absolute end-inline top-inline z-[2] bg-scrim text-on-live',
    centre:
      'absolute inset-0 z-[2] flex flex-col items-center justify-center gap-stack p-inset-card text-center text-body',
    notice:
      'absolute inset-x-0 top-inline z-[2] mx-auto my-0 w-max max-w-[90%] rounded-chip bg-scrim px-inset-control py-inline text-center text-label',
    caption:
      'absolute inset-x-0 bottom-0 z-[2] flex flex-col gap-inline ps-inset-card pb-stack text-on-live',
    progress: 'absolute inset-x-0 bottom-0 z-[3] h-[0.1875rem] rounded-none',
    actions: 'z-[4] flex flex-col items-center gap-stack',
    action:
      'group/action flex min-w-touch-target flex-col items-center gap-inline border-0 bg-transparent p-0 text-caption no-underline focus-ring',
    disc: 'flex size-control-lg items-center justify-center rounded-full transition-[background-color,transform] duration-fast ease-standard group-active/action:scale-[0.92] group-aria-pressed/action:bg-accent-soft group-aria-pressed/action:text-accent-ink motion-reduce:transition-colors motion-reduce:group-active/action:scale-100 in-data-[motion=reduced]:group-active/action:scale-100',
  },
  variants: {
    layout: {
      beside: {
        root: 'gap-section',
        frame:
          'w-[calc(min(100dvh-var(--layout-header)-2rem,56.25rem)*9/16)] max-w-full medium:max-w-[25.3125rem] expanded:max-w-[28.125rem] large:max-w-[31.625rem]',
        caption: 'pe-inset-card',
        action: 'text-fg',
        disc: 'bg-tint group-hover/action:bg-tint-strong',
      },
      overlay: {
        frame: 'h-[calc(100dvh-var(--layout-header)-3.5rem)] w-full',
        caption: 'pe-[4.5rem]',
        actions: 'absolute end-inline bottom-section',
        action: 'text-on-live',
        disc: 'bg-scrim group-hover/action:bg-tint-strong',
      },
    } satisfies Record<ShortsActionsLayout, object>,
  },
  defaultVariants: { layout: 'beside' },
});
