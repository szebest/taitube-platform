import { tv } from '@vp/ui';
import type { ShortsActionsLayout } from './types';

export const shortsPlayerFrameStyles = tv({
  slots: {
    root: 'tw:relative tw:flex tw:w-full tw:items-end tw:justify-center tw:font-sans tw:text-fg',
    nav: 'tw:hidden tw:flex-col tw:gap-stack tw:self-center tw:pointer-fine:flex',
    frame:
      'tw:relative tw:isolate tw:overflow-hidden tw:rounded-card tw:bg-media tw:text-on-live tw:shadow-3 tw:after:pointer-events-none tw:after:absolute tw:after:inset-x-0 tw:after:bottom-0 tw:after:h-[45%] tw:after:bg-linear-to-b tw:after:from-transparent tw:after:to-scrim tw:after:content-[""] tw:data-[enter=next]:animate-slide-in-from-bottom tw:data-[enter=previous]:animate-slide-in-from-top tw:motion-reduce:animate-none tw:in-data-[motion=reduced]:animate-none tw:data-[state=empty]:bg-surface tw:data-[state=empty]:text-fg tw:data-[state=empty]:shadow-none tw:data-[state=empty]:after:hidden',
    media: 'tw:absolute tw:inset-0 tw:*:size-full tw:*:object-cover',
    surface:
      'tw:absolute tw:inset-0 tw:z-[1] tw:flex tw:cursor-pointer tw:items-center tw:justify-center tw:border-0 tw:bg-transparent tw:p-0 tw:text-on-live tw:focus-ring',
    paused:
      'tw:flex tw:size-[4rem] tw:items-center tw:justify-center tw:rounded-full tw:bg-scrim tw:animate-fade-in',
    muted: 'tw:absolute tw:end-inline tw:top-inline tw:z-[2] tw:bg-scrim tw:text-on-live',
    centre:
      'tw:absolute tw:inset-0 tw:z-[2] tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-stack tw:p-inset-card tw:text-center tw:text-body',
    notice:
      'tw:absolute tw:inset-x-0 tw:top-inline tw:z-[2] tw:mx-auto tw:my-0 tw:w-max tw:max-w-[90%] tw:rounded-chip tw:bg-scrim tw:px-inset-control tw:py-inline tw:text-center tw:text-label',
    caption:
      'tw:absolute tw:inset-x-0 tw:bottom-0 tw:z-[2] tw:flex tw:flex-col tw:gap-inline tw:ps-inset-card tw:pb-stack tw:text-on-live',
    progress: 'tw:absolute tw:inset-x-0 tw:bottom-0 tw:z-[3] tw:h-[0.1875rem] tw:rounded-none',
    actions: 'tw:z-[4] tw:flex tw:flex-col tw:items-center tw:gap-stack',
    action:
      'tw:group/action tw:flex tw:min-w-touch-target tw:flex-col tw:items-center tw:gap-inline tw:border-0 tw:bg-transparent tw:p-0 tw:text-caption tw:no-underline tw:focus-ring',
    disc: 'tw:flex tw:size-control-lg tw:items-center tw:justify-center tw:rounded-full tw:transition-[background-color,transform] tw:duration-fast tw:ease-standard tw:group-active/action:scale-[0.92] tw:group-aria-pressed/action:bg-accent-soft tw:group-aria-pressed/action:text-accent-ink tw:motion-reduce:transition-colors tw:motion-reduce:group-active/action:scale-100 tw:in-data-[motion=reduced]:group-active/action:scale-100',
  },
  variants: {
    layout: {
      beside: {
        root: 'tw:gap-section',
        frame:
          'tw:w-[calc(min(100dvh-var(--layout-header)-2rem,56.25rem)*9/16)] tw:max-w-full tw:medium:max-w-[25.3125rem] tw:expanded:max-w-[28.125rem] tw:large:max-w-[31.625rem]',
        caption: 'tw:pe-inset-card',
        action: 'tw:text-fg',
        disc: 'tw:bg-tint tw:group-hover/action:bg-tint-strong',
      },
      overlay: {
        frame: 'tw:h-[calc(100dvh-var(--layout-header)-3.5rem)] tw:w-full',
        caption: 'tw:pe-[4.5rem]',
        actions: 'tw:absolute tw:end-inline tw:bottom-section',
        action: 'tw:text-on-live',
        disc: 'tw:bg-scrim tw:group-hover/action:bg-tint-strong',
      },
    } satisfies Record<ShortsActionsLayout, object>,
  },
  defaultVariants: { layout: 'beside' },
});
