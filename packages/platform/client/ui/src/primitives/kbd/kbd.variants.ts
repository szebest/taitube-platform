import { tv } from '../../lib/class-names';
import type { KbdFill, KbdSize } from './types';

export const kbdStyles = tv({
  base: 'inline-flex min-w-[calc(1lh+var(--space-1))] items-center justify-center rounded-xs border-control px-1 py-px font-mono tabular-nums in-data-disabled:text-fg-subtle',
  variants: {
    variant: {
      outline: 'border-border-strong text-fg-muted',
      soft: 'border-transparent bg-tint text-fg',
    } satisfies Record<KbdFill, string>,
    size: {
      sm: 'text-caption',
      md: 'text-mono',
    } satisfies Record<KbdSize, string>,
  },
  defaultVariants: { variant: 'outline', size: 'md' },
});
