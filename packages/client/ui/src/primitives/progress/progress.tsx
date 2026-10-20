import { Progress as ProgressPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { progressStyles } from './progress.variants';
import type { ProgressSize, ProgressTone } from './types';

const DEFAULT_MAX = 100;

export interface ProgressProps extends ComponentPropsWithRef<typeof ProgressPrimitive.Root> {
  size?: ProgressSize;
  tone?: ProgressTone;
}

/** A bar named by `aria-label`; without a `value` it is indeterminate. */
export function Progress({
  size,
  tone,
  value,
  max = DEFAULT_MAX,
  className,
  ...props
}: ProgressProps) {
  const styles = progressStyles({ size, tone });
  const filled = value === null || value === undefined ? 0 : (value / max) * 100;

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      max={max}
      className={styles.root({ className })}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={styles.indicator()}
        style={{ inlineSize: `${filled}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
