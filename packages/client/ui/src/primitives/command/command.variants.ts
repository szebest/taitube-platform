import { tv } from '../../lib/class-names';
import type { CommandSize, CommandVariant } from './types';

export const commandStyles = tv({
  slots: {
    root: 'flex flex-col overflow-hidden border-divider border-border bg-raised font-sans text-fg',
    inputRow:
      'flex items-center gap-inline border-b-divider border-border px-inset-control',
    input:
      'min-w-0 flex-1 border-0 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle',
    list: 'max-h-80 overflow-y-auto p-1',
    empty: 'px-inset-control py-inset-card text-center text-body-sm text-fg-muted',
    group:
      '[&_[cmdk-group-heading]]:px-inset-control [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-overline [&_[cmdk-group-heading]]:text-fg-muted',
    item: 'flex cursor-pointer items-center gap-inline rounded-sm px-inset-control text-label select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:text-fg-subtle data-[selected=true]:bg-tint [&_svg]:size-icon-sm [&_svg]:shrink-0',
    shortcut: 'ms-auto text-mono text-fg-muted',
  },
  variants: {
    variant: {
      inline: { root: 'rounded-card' },
      palette: { root: 'rounded-sheet shadow-3' },
    } satisfies Record<CommandVariant, object>,
    size: {
      sm: { item: 'h-control-sm', inputRow: 'h-control-md' },
      md: { item: 'h-control-md', inputRow: 'h-control-lg' },
    } satisfies Record<CommandSize, object>,
  },
  defaultVariants: { variant: 'inline', size: 'md' },
});
