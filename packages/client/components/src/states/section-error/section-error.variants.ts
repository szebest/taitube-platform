import { tv } from '@vp/ui';
import type { SectionErrorLayout, SectionErrorTone } from './types';

export const sectionErrorStyles = tv({
  slots: {
    root: 'tw:flex tw:gap-x-stack tw:gap-y-inline tw:rounded-card tw:border-divider tw:border-border tw:bg-surface tw:p-inset-control tw:font-sans tw:text-fg',
    icon: 'tw:size-icon-md tw:shrink-0',
    text: 'tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-inline',
    message: 'tw:m-0 tw:text-label',
    support: 'tw:m-0 tw:text-body-sm tw:text-fg-muted',
  },
  variants: {
    layout: {
      bar: { root: 'tw:min-h-control-lg tw:flex-wrap tw:items-center' },
      block: {
        root: 'tw:flex-col tw:items-center tw:justify-center tw:text-center',
        text: 'tw:max-w-reading-max tw:flex-none tw:items-center',
      },
    } satisfies Record<SectionErrorLayout, object>,
    tone: {
      danger: { icon: 'tw:text-danger-ink' },
      warning: { icon: 'tw:text-warning-ink' },
    } satisfies Record<SectionErrorTone, object>,
  },
  defaultVariants: { layout: 'bar', tone: 'danger' },
});
