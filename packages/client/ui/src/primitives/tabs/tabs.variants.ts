import { tv } from '../../lib/class-names';
import { slidingIndicatorBase } from '../../lib/sliding-indicator';
import type { TabsFill, TabsOrientation, TabsSize } from './types';

export const tabsStyles = tv({
  slots: {
    root: 'flex gap-stack font-sans text-fg data-[orientation=horizontal]:flex-col',
    list: 'relative flex gap-inline overflow-auto',
    tab: 'relative inline-flex shrink-0 cursor-pointer items-center gap-inline border-0 bg-transparent px-inset-control text-label whitespace-nowrap text-fg-muted transition-colors duration-fast focus-ring hover:text-fg active:bg-tint-strong disabled:pointer-events-none disabled:text-fg-subtle data-[state=active]:text-fg motion-reduce:transition-none [&_svg]:size-icon-sm',
    indicator: slidingIndicatorBase,
    panel: 'focus-ring',
  },
  variants: {
    variant: {
      ghost: { tab: 'rounded-none' },
      soft: {
        tab: 'rounded-chip hover:bg-tint not-in-data-[indicator=shown]:data-[state=active]:bg-tint-strong',
        indicator:
          'h-(--indicator-height) w-(--indicator-width) translate-x-(--indicator-x) translate-y-(--indicator-y) rounded-chip bg-tint-strong',
      },
    } satisfies Record<TabsFill, object>,
    size: {
      sm: { tab: 'h-control-sm' },
      md: { tab: 'h-control-md' },
    } satisfies Record<TabsSize, object>,
    orientation: {
      horizontal: { list: 'flex-row' },
      vertical: { root: 'flex-row', list: 'flex-col' },
    } satisfies Record<TabsOrientation, object>,
  },
  compoundVariants: [
    {
      variant: 'ghost',
      orientation: 'horizontal',
      class: {
        list: 'border-b-divider border-border',
        tab: 'not-in-data-[indicator=shown]:data-[state=active]:shadow-[inset_0_-2px_0_0_var(--accent)]',
        indicator:
          'h-0.5 w-(--indicator-width) translate-x-(--indicator-x) translate-y-[calc(var(--indicator-y)+var(--indicator-height)-100%)] bg-accent',
      },
    },
    {
      variant: 'ghost',
      orientation: 'vertical',
      class: {
        list: 'border-e-divider border-border',
        tab: 'justify-start not-in-data-[indicator=shown]:data-[state=active]:shadow-[inset_-2px_0_0_0_var(--accent)] rtl:not-in-data-[indicator=shown]:data-[state=active]:shadow-[inset_2px_0_0_0_var(--accent)]',
        indicator:
          'start-auto end-0 h-(--indicator-height) w-0.5 translate-y-(--indicator-y) bg-accent',
      },
    },
  ],
  defaultVariants: { variant: 'ghost', size: 'md', orientation: 'horizontal' },
});
