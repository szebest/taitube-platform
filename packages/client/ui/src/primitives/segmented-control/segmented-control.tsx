import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { useSlidingIndicator } from '../../lib/sliding-indicator';
import { SegmentedControlContext, useSegmentedControl } from './segmented-control.context';
import { segmentedControlStyles } from './segmented-control.variants';
import type { SegmentedSize, SegmentedTone } from './types';

export interface SegmentedControlRootProps
  extends ComponentPropsWithRef<typeof RadioGroupPrimitive.Root> {
  tone?: SegmentedTone;
  size?: SegmentedSize;
}

/** Exactly one of two to five options, never empty; name the group with `aria-label`. */
export function SegmentedControlRoot({
  tone = 'neutral',
  size = 'md',
  ref,
  className,
  children,
  ...props
}: SegmentedControlRootProps) {
  const shared = { tone, size };
  const styles = segmentedControlStyles(shared);
  const indicated = useSlidingIndicator('[data-state="checked"]', ref);

  return (
    <SegmentedControlContext value={shared}>
      <RadioGroupPrimitive.Root
        ref={indicated}
        data-slot="segmented-control"
        className={styles.root({ className })}
        {...props}
      >
        <span
          aria-hidden="true"
          data-slot="segmented-control-indicator"
          className={styles.indicator()}
        />
        {children}
      </RadioGroupPrimitive.Root>
    </SegmentedControlContext>
  );
}

export type SegmentedControlItemProps = ComponentPropsWithRef<typeof RadioGroupPrimitive.Item>;

export function SegmentedControlItem({ className, ...props }: SegmentedControlItemProps) {
  const shared = useSegmentedControl('Item');

  return (
    <RadioGroupPrimitive.Item
      data-slot="segmented-control-item"
      className={segmentedControlStyles(shared).item({ className })}
      {...props}
    />
  );
}
