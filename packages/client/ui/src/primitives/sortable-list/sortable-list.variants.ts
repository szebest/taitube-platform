import { tv } from '../../lib/class-names';
import type { SortableOrientation } from './types';

export const sortableListStyles = tv({
  slots: {
    root: 'm-0 flex list-none gap-inline p-0',
    item: 'relative flex items-center gap-inline',
    handle:
      'inline-flex size-control-sm min-h-touch-target min-w-touch-target shrink-0 cursor-grab touch-none items-center justify-center rounded-sm border-0 bg-transparent p-0 text-fg-muted focus-ring hover:text-fg active:cursor-grabbing',
  },
  variants: {
    orientation: {
      vertical: { root: 'flex-col' },
      horizontal: { root: 'flex-row' },
    } satisfies Record<SortableOrientation, object>,
    pickedUp: {
      true: { item: 'z-popover scale-[1.02] rounded-card bg-raised shadow-2' },
      false: {},
    },
  },
  defaultVariants: { orientation: 'vertical', pickedUp: false },
});
