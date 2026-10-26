import { tv } from '../../lib/class-names';
import type { SortableOrientation } from './types';

export const sortableListStyles = tv({
  slots: {
    root: 'tw:m-0 tw:flex tw:list-none tw:gap-inline tw:p-0',
    item: 'tw:relative tw:flex tw:items-center tw:gap-inline',
    handle:
      'tw:inline-flex tw:size-control-sm tw:min-h-touch-target tw:min-w-touch-target tw:shrink-0 tw:cursor-grab tw:touch-none tw:items-center tw:justify-center tw:rounded-sm tw:border-0 tw:bg-transparent tw:p-0 tw:text-fg-muted tw:focus-ring tw:hover:text-fg tw:active:cursor-grabbing',
  },
  variants: {
    orientation: {
      vertical: { root: 'tw:flex-col' },
      horizontal: { root: 'tw:flex-row' },
    } satisfies Record<SortableOrientation, object>,
    pickedUp: {
      true: { item: 'tw:z-popover tw:scale-[1.02] tw:rounded-card tw:bg-raised tw:shadow-2' },
      false: {},
    },
  },
  defaultVariants: { orientation: 'vertical', pickedUp: false },
});
