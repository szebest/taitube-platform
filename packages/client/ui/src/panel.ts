import { tv } from './lib/class-names';

/** The floating surface a menu or a select list opens on, and the rows inside it. */
export const panelVariants = tv({
  slots: {
    content:
      'z-popover min-w-40 overflow-x-hidden overflow-y-auto rounded-card border border-border bg-raised p-1 font-sans text-fg shadow-2 motion-enter',
    item: 'relative flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 text-label outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-tint [&_svg]:size-4 [&_svg]:shrink-0',
    label: 'px-3 py-1.5 text-overline text-fg-muted',
    separator: '-mx-1 my-1 h-px bg-tint-strong',
  },
  variants: {
    kind: {
      select: {
        content:
          'relative max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) origin-(--radix-select-content-transform-origin)',
        item: 'w-full pe-8',
      },
    },
  },
});
