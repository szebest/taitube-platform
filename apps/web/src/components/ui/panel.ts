import { tv } from './class-names';

/** The floating surface a menu or a select list opens on, and the rows inside it. */
export const panelVariants = tv({
  slots: {
    content:
      'tw:z-dropdown tw:min-w-40 tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-lg tw:border tw:border-border tw:bg-popover tw:p-1 tw:font-sans tw:text-fg tw:shadow-md tw:data-[state=open]:animate-pop-in tw:data-[state=closed]:animate-pop-out tw:motion-reduce:animate-none',
    item: 'tw:relative tw:flex tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-md tw:px-3 tw:py-2 tw:text-sm tw:outline-none tw:select-none tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50 tw:data-highlighted:bg-tint tw:[&_svg]:size-4 tw:[&_svg]:shrink-0',
    label: 'tw:px-3 tw:py-1.5 tw:text-xs tw:text-fg-muted',
    separator: 'tw:-mx-1 tw:my-1 tw:h-px tw:bg-tint-strong',
  },
  variants: {
    kind: {
      menu: {
        content:
          'tw:max-h-(--radix-dropdown-menu-content-available-height) tw:origin-(--radix-dropdown-menu-content-transform-origin)',
        item: 'tw:data-[state=open]:bg-tint',
      },
      select: {
        content:
          'tw:relative tw:max-h-(--radix-select-content-available-height) tw:min-w-(--radix-select-trigger-width) tw:origin-(--radix-select-content-transform-origin)',
        item: 'tw:w-full tw:pr-8',
      },
    },
    variant: {
      default: {},
      destructive: { item: 'tw:text-danger tw:data-highlighted:bg-danger/10' },
    },
  },
  defaultVariants: { variant: 'default' },
});
