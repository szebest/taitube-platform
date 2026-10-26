import { Slot } from 'radix-ui';
import type { ComponentPropsWithRef, MouseEvent } from 'react';
import { SpinnerRing } from '../spinner/spinner';
import { buttonStyles } from './button.variants';
import type { ButtonFill, ButtonShape, ButtonSize, ButtonTone } from './types';

interface ButtonLook {
  variant?: ButtonFill;
  tone?: ButtonTone;
  size?: ButtonSize;
  shape?: ButtonShape;
}

type ButtonElement =
  | {
      asChild?: false;
      /** Draws a spinner over the label, keeps the width and ignores clicks. */
      loading?: boolean;
    }
  | {
      /** Styles its one child, a link for one, instead of rendering a `<button>`. */
      asChild: true;
      loading?: never;
    };

export type ButtonProps = ComponentPropsWithRef<'button'> & ButtonLook & ButtonElement;

export function Button({
  variant,
  tone,
  size,
  shape,
  asChild,
  loading = false,
  type = 'button',
  className,
  children,
  onClick,
  ...props
}: ButtonProps) {
  const classes = buttonStyles({ variant, tone, size, shape, className });

  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={classes} onClick={onClick} {...props}>
        {children}
      </Slot.Root>
    );
  }

  const ignoreWhileLoading = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }

    onClick?.(event);
  };

  return (
    <button
      data-slot="button"
      type={type}
      aria-busy={loading || undefined}
      className={classes}
      onClick={ignoreWhileLoading}
      {...props}
    >
      <span className="tw:inline-flex tw:items-center tw:gap-inline tw:group-aria-busy/button:opacity-0">
        {children}
      </span>
      {loading && <SpinnerRing className="tw:absolute" />}
    </button>
  );
}
