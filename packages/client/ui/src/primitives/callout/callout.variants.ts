import { tv } from '../../lib/class-names';
import type { CalloutFill, CalloutTone } from './types';

export const calloutStyles = tv({
  slots: {
    root: 'tw:grid tw:max-w-reading-max tw:grid-cols-1 tw:items-start tw:gap-x-stack tw:gap-y-inline tw:rounded-card tw:p-inset-card tw:font-sans tw:text-fg tw:has-[>[data-slot=callout-icon]]:grid-cols-[auto_1fr]',
    icon: 'tw:row-span-3 tw:size-icon-md',
    title: 'tw:m-0 tw:text-label tw:[[data-slot=callout-icon]~&]:col-start-2',
    body: 'tw:m-0 tw:text-body-sm tw:[[data-slot=callout-icon]~&]:col-start-2',
    action: 'tw:flex tw:gap-inline tw:[[data-slot=callout-icon]~&]:col-start-2',
  },
  variants: {
    variant: {
      soft: { root: 'tw:bg-tint' },
      outline: { root: 'tw:border-control tw:border-border-strong tw:bg-transparent' },
    } satisfies Record<CalloutFill, object>,
    tone: {
      neutral: { icon: 'tw:text-fg-muted' },
      accent: { icon: 'tw:text-accent-ink' },
      success: { icon: 'tw:text-success-ink', title: 'tw:text-success-ink' },
      warning: { icon: 'tw:text-warning-ink', title: 'tw:text-warning-ink' },
      danger: { icon: 'tw:text-danger-ink', title: 'tw:text-danger-ink' },
      info: { icon: 'tw:text-info-ink', title: 'tw:text-info-ink' },
    } satisfies Record<CalloutTone, object>,
  },
  compoundVariants: [{ variant: 'soft', tone: 'accent', class: { root: 'tw:bg-accent-soft' } }],
  defaultVariants: { variant: 'soft', tone: 'accent' },
});
