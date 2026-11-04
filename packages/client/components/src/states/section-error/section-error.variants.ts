import { tv } from '@vp/ui';
import type { SectionErrorLayout, SectionErrorTone } from './types';

export const sectionErrorStyles = tv({
  slots: {
    root: 'flex gap-x-stack gap-y-inline rounded-card border-divider border-border bg-surface p-inset-control font-sans text-fg',
    icon: 'size-icon-md shrink-0',
    text: 'flex min-w-0 flex-1 flex-col gap-inline',
    message: 'm-0 text-label',
    support: 'm-0 text-body-sm text-fg-muted',
  },
  variants: {
    layout: {
      bar: { root: 'min-h-control-lg flex-wrap items-center' },
      block: {
        root: 'flex-col items-center justify-center text-center',
        text: 'max-w-reading-max flex-none items-center',
      },
    } satisfies Record<SectionErrorLayout, object>,
    tone: {
      danger: { icon: 'text-danger-ink' },
      warning: { icon: 'text-warning-ink' },
    } satisfies Record<SectionErrorTone, object>,
  },
  defaultVariants: { layout: 'bar', tone: 'danger' },
});
