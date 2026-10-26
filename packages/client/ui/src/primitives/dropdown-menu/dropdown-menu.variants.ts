import { tv } from '../../lib/class-names';
import type { MenuSize, MenuTone } from './types';

export const menuStyles = tv({
  slots: {
    content:
      'tw:z-popover tw:min-w-44 tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-card tw:border-divider tw:border-border tw:bg-raised tw:p-1 tw:font-sans tw:text-fg tw:shadow-2 tw:data-[state=closed]:animate-pop-out tw:data-[state=open]:animate-pop-in tw:motion-reduce:animate-none',
    item: 'tw:relative tw:flex tw:cursor-pointer tw:items-center tw:gap-inline tw:rounded-sm tw:px-inset-control tw:text-label tw:outline-none tw:select-none tw:data-disabled:pointer-events-none tw:data-disabled:text-fg-subtle tw:data-highlighted:bg-tint tw:data-[state=open]:bg-tint tw:[&_svg]:size-icon-sm tw:[&_svg]:shrink-0',
    label: 'tw:px-inset-control tw:py-1 tw:text-overline tw:text-fg-muted',
    separator: 'tw:-mx-1 tw:my-1 tw:h-px tw:bg-border',
    shortcut: 'tw:ms-auto tw:ps-inline tw:text-mono tw:text-fg-muted',
    indicator: 'tw:ms-auto tw:inline-flex tw:items-center tw:text-accent-ink',
  },
  variants: {
    size: {
      sm: { item: 'tw:h-control-sm' },
      md: { item: 'tw:h-control-md' },
    } satisfies Record<MenuSize, object>,
    tone: {
      neutral: {},
      danger: { item: 'tw:text-danger-ink' },
    } satisfies Record<MenuTone, object>,
  },
  defaultVariants: { size: 'md', tone: 'neutral' },
});
