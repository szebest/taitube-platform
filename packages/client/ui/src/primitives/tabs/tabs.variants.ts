import { tv } from '../../lib/class-names';
import type { TabsFill, TabsOrientation, TabsSize } from './types';

export const tabsStyles = tv({
  slots: {
    root: 'tw:flex tw:gap-stack tw:font-sans tw:text-fg tw:data-[orientation=horizontal]:flex-col',
    list: 'tw:flex tw:gap-inline tw:overflow-auto',
    tab: 'tw:inline-flex tw:shrink-0 tw:cursor-pointer tw:items-center tw:gap-inline tw:border-0 tw:bg-transparent tw:px-inset-control tw:text-label tw:whitespace-nowrap tw:text-fg-muted tw:transition-colors tw:duration-fast tw:focus-ring tw:hover:text-fg tw:active:bg-tint-strong tw:disabled:pointer-events-none tw:disabled:text-fg-subtle tw:data-[state=active]:text-fg tw:motion-reduce:transition-none tw:[&_svg]:size-icon-sm',
    panel: 'tw:focus-ring',
  },
  variants: {
    variant: {
      ghost: { tab: 'tw:rounded-none' },
      soft: {
        tab: 'tw:rounded-chip tw:hover:bg-tint tw:data-[state=active]:bg-tint-strong',
      },
    } satisfies Record<TabsFill, object>,
    size: {
      sm: { tab: 'tw:h-control-sm' },
      md: { tab: 'tw:h-control-md' },
    } satisfies Record<TabsSize, object>,
    orientation: {
      horizontal: { list: 'tw:flex-row' },
      vertical: { root: 'tw:flex-row', list: 'tw:flex-col' },
    } satisfies Record<TabsOrientation, object>,
  },
  compoundVariants: [
    {
      variant: 'ghost',
      orientation: 'horizontal',
      class: {
        list: 'tw:border-b-divider tw:border-border',
        tab: 'tw:data-[state=active]:shadow-[inset_0_-2px_0_0_var(--accent)]',
      },
    },
    {
      variant: 'ghost',
      orientation: 'vertical',
      class: {
        list: 'tw:border-e-divider tw:border-border',
        tab: 'tw:justify-start tw:data-[state=active]:shadow-[inset_-2px_0_0_0_var(--accent)] tw:rtl:data-[state=active]:shadow-[inset_2px_0_0_0_var(--accent)]',
      },
    },
  ],
  defaultVariants: { variant: 'ghost', size: 'md', orientation: 'horizontal' },
});
