import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
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
  className,
  ...props
}: SegmentedControlRootProps) {
  const shared = useMemo(() => ({ tone, size }), [tone, size]);

  return (
    <SegmentedControlContext value={shared}>
      <RadioGroupPrimitive.Root
        data-slot="segmented-control"
        className={segmentedControlStyles(shared).root({ className })}
        {...props}
      />
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
