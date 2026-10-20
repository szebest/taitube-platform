import type { IconSize } from '@vp/design-tokens';
import { LoaderCircle } from 'lucide-react';
import type { ComponentPropsWithRef } from 'react';
import { cn } from '../../lib/class-names';
import { useUiCopy } from '../../copy/ui-copy';
import { VisuallyHidden } from '../visually-hidden';
import { spinnerStyles } from './spinner.variants';
import type { SpinnerTone } from './types';

/** The turning ring alone, hidden from assistive technology: a busy button draws it over its label. */
function SpinnerRing({ className }: { className?: string }) {
  return (
    <LoaderCircle
      aria-hidden="true"
      strokeWidth={1.75}
      className={cn('tw:size-full tw:motion-safe:animate-spin', className)}
    />
  );
}

export interface SpinnerProps extends ComponentPropsWithRef<'span'> {
  size?: IconSize;
  tone?: SpinnerTone;
}

/** A status that names what is loading: its children, read out instead of the ring, or the `loading` word. */
export function Spinner({ size, tone, className, children, ...props }: SpinnerProps) {
  const { loading } = useUiCopy();

  return (
    <span
      data-slot="spinner"
      role="status"
      className={spinnerStyles({ size, tone, className })}
      {...props}
    >
      <SpinnerRing />
      <VisuallyHidden>{children ?? loading}</VisuallyHidden>
    </span>
  );
}
