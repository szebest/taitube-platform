import { tv } from '../../lib/class-names';
import type { MenuSize, MenuTone } from './types';

export const menuStyles = tv({
  slots: {
    content:
      'z-popover min-w-44 overflow-x-hidden overflow-y-auto rounded-card border-divider border-border bg-raised p-1 font-sans text-fg shadow-2 motion-enter',
    item: 'relative flex cursor-pointer items-center gap-inline rounded-sm px-inset-control text-label outline-none select-none data-disabled:pointer-events-none data-disabled:text-fg-subtle data-highlighted:bg-tint data-[state=open]:bg-tint [&_svg]:size-icon-sm [&_svg]:shrink-0',
    label: 'px-inset-control py-1 text-overline text-fg-muted',
    separator: '-mx-1 my-1 h-px bg-border',
    shortcut: 'ms-auto ps-inline text-mono text-fg-muted',
    indicator: 'ms-auto inline-flex items-center text-accent-ink',
  },
  variants: {
    size: {
      sm: { item: 'h-control-sm' },
      md: { item: 'h-control-md' },
    } satisfies Record<MenuSize, object>,
    tone: {
      neutral: {},
      danger: { item: 'text-danger-ink' },
    } satisfies Record<MenuTone, object>,
  },
  defaultVariants: { size: 'md', tone: 'neutral' },
});
