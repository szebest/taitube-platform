import { tv } from '../../lib/class-names';
import type { CalloutFill, CalloutTone } from './types';

export const calloutStyles = tv({
  slots: {
    root: 'grid max-w-reading-max grid-cols-1 items-start gap-x-stack gap-y-inline rounded-card p-inset-card font-sans text-fg has-[>[data-slot=callout-icon]]:grid-cols-[auto_1fr]',
    icon: 'row-span-3 size-icon-md',
    title: 'm-0 text-label [[data-slot=callout-icon]~&]:col-start-2',
    body: 'm-0 text-body-sm [[data-slot=callout-icon]~&]:col-start-2',
    action: 'flex gap-inline [[data-slot=callout-icon]~&]:col-start-2',
  },
  variants: {
    variant: {
      soft: { root: 'bg-tint' },
      outline: { root: 'border-control border-border-strong bg-transparent' },
    } satisfies Record<CalloutFill, object>,
    tone: {
      neutral: { icon: 'text-fg-muted' },
      accent: { icon: 'text-accent-ink' },
      success: { icon: 'text-success-ink', title: 'text-success-ink' },
      warning: { icon: 'text-warning-ink', title: 'text-warning-ink' },
      danger: { icon: 'text-danger-ink', title: 'text-danger-ink' },
      info: { icon: 'text-info-ink', title: 'text-info-ink' },
    } satisfies Record<CalloutTone, object>,
  },
  compoundVariants: [{ variant: 'soft', tone: 'accent', class: { root: 'bg-accent-soft' } }],
  defaultVariants: { variant: 'soft', tone: 'accent' },
});
