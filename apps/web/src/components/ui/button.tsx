import { Slot } from '@radix-ui/react-slot';
import type { ComponentProps } from 'react';

import { type VariantProps, tv } from 'tailwind-variants';

export const buttonVariants = tv({
  base: 'tw:inline-flex tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:gap-2 tw:rounded-full tw:border-0 tw:font-sans tw:font-medium tw:whitespace-nowrap tw:no-underline tw:transition-colors tw:select-none tw:focus-ring tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0',
  variants: {
    variant: {
      primary: 'tw:bg-accent tw:text-on-accent tw:hover:bg-accent-hover',
      secondary: 'tw:bg-surface-elevated tw:text-fg tw:hover:bg-surface-hover',
      outline:
        'tw:border tw:border-border-strong tw:bg-transparent tw:text-fg tw:hover:bg-surface-hover',
      ghost: 'tw:bg-transparent tw:text-fg tw:hover:bg-surface-hover',
      destructive: 'tw:bg-danger-solid tw:text-on-danger tw:hover:bg-danger-solid-hover',
    },
    size: {
      sm: 'tw:h-8 tw:text-sm tw:[&_svg]:size-4',
      md: 'tw:h-9 tw:text-sm tw:[&_svg]:size-5',
      lg: 'tw:h-11 tw:text-base tw:[&_svg]:size-6',
    },
    shape: {
      text: '',
      icon: 'tw:aspect-square tw:p-0',
    },
  },
  compoundVariants: [
    { shape: 'text', size: 'sm', class: 'tw:px-3' },
    { shape: 'text', size: 'md', class: 'tw:px-4' },
    { shape: 'text', size: 'lg', class: 'tw:px-6' },
  ],
  defaultVariants: { variant: 'secondary', size: 'md', shape: 'text' },
});

type ButtonVariants = Omit<VariantProps<typeof buttonVariants>, 'shape'>;

export type ButtonProps = ComponentProps<'button'> &
  ButtonVariants & {
    /** Styles its one child, a link for instance, instead of rendering a `<button>`. */
    asChild?: boolean;
  };

export function Button({
  variant,
  size,
  asChild = false,
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  const classes = buttonVariants({ variant, size, className });

  if (asChild) return <Slot data-slot="button" className={classes} {...props} />;
  return <button data-slot="button" type={type} className={classes} {...props} />;
}

/** A button that shows only an icon, so it must be named for assistive technology. */
export type IconButtonProps = ButtonProps & { 'aria-label': string };

export function IconButton({
  variant = 'ghost',
  size,
  asChild = false,
  type = 'button',
  className,
  ...props
}: IconButtonProps) {
  const classes = buttonVariants({ variant, size, shape: 'icon', className });

  if (asChild) return <Slot data-slot="icon-button" className={classes} {...props} />;
  return <button data-slot="icon-button" type={type} className={classes} {...props} />;
}
