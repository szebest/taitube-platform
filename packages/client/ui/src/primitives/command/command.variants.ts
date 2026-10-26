import { tv } from '../../lib/class-names';
import type { CommandSize, CommandVariant } from './types';

export const commandStyles = tv({
  slots: {
    root: 'tw:flex tw:flex-col tw:overflow-hidden tw:border-divider tw:border-border tw:bg-raised tw:font-sans tw:text-fg',
    inputRow:
      'tw:flex tw:items-center tw:gap-inline tw:border-b-divider tw:border-border tw:px-inset-control',
    input:
      'tw:min-w-0 tw:flex-1 tw:border-0 tw:bg-transparent tw:text-body tw:text-fg tw:outline-none tw:placeholder:text-fg-subtle',
    list: 'tw:max-h-80 tw:overflow-y-auto tw:p-1',
    empty: 'tw:px-inset-control tw:py-inset-card tw:text-center tw:text-body-sm tw:text-fg-muted',
    group:
      'tw:[&_[cmdk-group-heading]]:px-inset-control tw:[&_[cmdk-group-heading]]:py-1 tw:[&_[cmdk-group-heading]]:text-overline tw:[&_[cmdk-group-heading]]:text-fg-muted',
    item: 'tw:flex tw:cursor-pointer tw:items-center tw:gap-inline tw:rounded-sm tw:px-inset-control tw:text-label tw:select-none tw:data-[disabled=true]:pointer-events-none tw:data-[disabled=true]:text-fg-subtle tw:data-[selected=true]:bg-tint tw:[&_svg]:size-icon-sm tw:[&_svg]:shrink-0',
    shortcut: 'tw:ms-auto tw:text-mono tw:text-fg-muted',
  },
  variants: {
    variant: {
      inline: { root: 'tw:rounded-card' },
      palette: { root: 'tw:rounded-sheet tw:shadow-3' },
    } satisfies Record<CommandVariant, object>,
    size: {
      sm: { item: 'tw:h-control-sm', inputRow: 'tw:h-control-md' },
      md: { item: 'tw:h-control-md', inputRow: 'tw:h-control-lg' },
    } satisfies Record<CommandSize, object>,
  },
  defaultVariants: { variant: 'inline', size: 'md' },
});
