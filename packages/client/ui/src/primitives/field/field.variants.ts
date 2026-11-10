import { tv } from '../../lib/class-names';
import type { FieldOrientation } from './types';

const CONTROL = '[&>:not([data-slot^=field-])]';

export const fieldStyles = tv({
  slots: {
    root: 'min-w-0 font-sans',
    label: '',
    hint: 'm-0 text-caption text-fg-muted select-text',
    error: 'm-0 flex items-center gap-inline text-caption text-danger-ink select-text',
  },
  variants: {
    orientation: {
      vertical: { root: 'flex flex-col gap-inline' },
      horizontal: {
        root: `grid grid-cols-[auto_1fr] items-center gap-x-inline gap-y-1 ${CONTROL}:col-start-1 ${CONTROL}:row-start-1`,
        label: 'col-start-2 row-start-1',
        hint: 'col-start-2',
        error: 'col-start-2',
      },
    } satisfies Record<FieldOrientation, object>,
  },
  defaultVariants: { orientation: 'vertical' },
});
