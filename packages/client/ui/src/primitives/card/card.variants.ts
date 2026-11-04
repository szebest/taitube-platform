import { tv } from '../../lib/class-names';
import type { CardElevation, CardFill, CardSize } from './types';

export const cardStyles = tv({
  slots: {
    root: 'flex flex-col rounded-card font-sans text-fg no-underline transition-shadow duration-slow ease-settle motion-reduce:transition-none [a&,button&]:cursor-pointer [a&,button&]:text-start [a&,button&]:focus-ring [a&,button&]:hover:shadow-2',
    header: 'grid grid-cols-[1fr_auto] items-start gap-x-stack',
    title: 'col-start-1 m-0 text-title',
    description: 'col-start-1 m-0 text-body-sm text-fg-muted',
    action: 'col-start-2 row-span-2 row-start-1 self-center',
    body: '',
    footer: 'flex items-center justify-end gap-inline',
  },
  variants: {
    variant: {
      solid: { root: 'border-divider border-border bg-surface' },
      outline: { root: 'border-control border-border-strong bg-transparent' },
      ghost: { root: 'bg-transparent' },
    } satisfies Record<CardFill, object>,
    elevation: {
      1: { root: 'shadow-1' },
      2: { root: 'bg-raised shadow-2' },
      3: { root: 'bg-raised shadow-3' },
    } satisfies Record<CardElevation, object>,
    size: {
      sm: { root: 'gap-inline p-inset-control', header: 'gap-y-1' },
      md: { root: 'gap-stack p-inset-card', header: 'gap-y-inline' },
    } satisfies Record<CardSize, object>,
  },
  defaultVariants: { variant: 'solid', size: 'md' },
});
