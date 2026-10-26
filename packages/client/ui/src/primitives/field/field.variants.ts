import { tv } from '../../lib/class-names';
import type { FieldOrientation } from './types';

const CONTROL = '[&>:not([data-slot^=field-])]';

export const fieldStyles = tv({
  slots: {
    root: 'tw:font-sans',
    label: '',
    hint: 'tw:m-0 tw:text-caption tw:text-fg-muted',
    error: 'tw:m-0 tw:flex tw:items-center tw:gap-inline tw:text-caption tw:text-danger-ink',
  },
  variants: {
    orientation: {
      vertical: { root: 'tw:flex tw:flex-col tw:gap-inline' },
      horizontal: {
        root: `tw:grid tw:grid-cols-[auto_1fr] tw:items-center tw:gap-x-inline tw:gap-y-1 tw:${CONTROL}:col-start-1 tw:${CONTROL}:row-start-1`,
        label: 'tw:col-start-2 tw:row-start-1',
        hint: 'tw:col-start-2',
        error: 'tw:col-start-2',
      },
    } satisfies Record<FieldOrientation, object>,
  },
  defaultVariants: { orientation: 'vertical' },
});
