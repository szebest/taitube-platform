import { Slot } from '@radix-ui/react-slot';
import { LoaderCircle } from 'lucide-react';
import type { ComponentProps, MouseEvent } from 'react';
import { type VariantProps, tv } from 'tailwind-variants';

export const buttonVariants = tv({
  base: 'tw:group/button tw:relative tw:inline-flex tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:gap-2 tw:rounded-full tw:border-0 tw:font-sans tw:font-medium tw:whitespace-nowrap tw:no-underline tw:transition tw:duration-150 tw:select-none tw:focus-ring tw:active:scale-97 tw:motion-reduce:transition-none tw:motion-reduce:active:scale-100 tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:aria-busy:cursor-progress tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0',
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

type ButtonElement =
  | {
      asChild?: false;
      /** Shows a spinner in place of the content, keeps the width and ignores clicks. */
      loading?: boolean;
    }
  | {
      /** Styles its one child, a link for instance, instead of rendering a `<button>`. */
      asChild: true;
      loading?: never;
    };

export type ButtonProps = ComponentProps<'button'> & ButtonVariants & ButtonElement;

type ShapedButtonProps = ButtonProps & { shape: 'text' | 'icon'; slot: string };

function ShapedButton({
  shape,
  slot,
  variant,
  size,
  asChild,
  loading = false,
  type = 'button',
  className,
  children,
  onClick,
  ...props
}: ShapedButtonProps) {
  const classes = buttonVariants({ variant, size, shape, className });

  if (asChild) {
    return (
      <Slot data-slot={slot} className={classes} onClick={onClick} {...props}>
        {children}
      </Slot>
    );
  }

  const ignoreWhileLoading = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) event.preventDefault();
    else onClick?.(event);
  };

  return (
    <button
      data-slot={slot}
      type={type}
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={classes}
      onClick={ignoreWhileLoading}
      {...props}
    >
      <span className="tw:inline-flex tw:items-center tw:gap-2 tw:group-aria-busy/button:opacity-0">
        {children}
      </span>
      {loading && (
        <LoaderCircle
          aria-hidden="true"
          className="tw:absolute tw:animate-spin tw:motion-reduce:animate-none"
        />
      )}
    </button>
  );
}

export function Button(props: ButtonProps) {
  return <ShapedButton {...props} shape="text" slot="button" />;
}

/** A button that shows only an icon, so it must be named for assistive technology. */
export type IconButtonProps = ButtonProps & { 'aria-label': string };

export function IconButton({ variant = 'ghost', ...props }: IconButtonProps) {
  return <ShapedButton variant={variant} {...props} shape="icon" slot="icon-button" />;
}
