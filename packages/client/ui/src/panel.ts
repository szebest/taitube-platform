import { tv } from './lib/class-names';

/** The floating surface a menu or a select list opens on, and the rows inside it. */
export const panelVariants = tv({
  slots: {
    content:
      'tw:z-popover tw:min-w-40 tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-card tw:border tw:border-border tw:bg-raised tw:p-1 tw:font-sans tw:text-fg tw:shadow-2 tw:motion-enter',
    item: 'tw:relative tw:flex tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-sm tw:px-3 tw:py-2 tw:text-label tw:outline-none tw:select-none tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50 tw:data-highlighted:bg-tint tw:[&_svg]:size-4 tw:[&_svg]:shrink-0',
    label: 'tw:px-3 tw:py-1.5 tw:text-overline tw:text-fg-muted',
    separator: 'tw:-mx-1 tw:my-1 tw:h-px tw:bg-tint-strong',
  },
  variants: {
    kind: {
      select: {
        content:
          'tw:relative tw:max-h-(--radix-select-content-available-height) tw:min-w-(--radix-select-trigger-width) tw:origin-(--radix-select-content-transform-origin)',
        item: 'tw:w-full tw:pe-8',
      },
    },
  },
});
