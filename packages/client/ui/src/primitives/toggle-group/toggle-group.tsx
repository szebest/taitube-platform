import { ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { ToggleGroupContext, useToggleGroup } from './toggle-group.context';
import { toggleGroupStyles } from './toggle-group.variants';
import type { ToggleFill, ToggleShape, ToggleSize } from './types';

export type ToggleGroupRootProps = ComponentPropsWithRef<typeof ToggleGroupPrimitive.Root> & {
  variant?: ToggleFill;
  size?: ToggleSize;
  shape?: ToggleShape;
};

/** Icon-only items need an `aria-label`, and the group a name when no heading precedes it. */
export function ToggleGroupRoot({
  variant = 'ghost',
  size = 'md',
  shape = 'text',
  orientation = 'horizontal',
  className,
  ...props
}: ToggleGroupRootProps) {
  const shared = useMemo(
    () => ({ variant, size, shape, orientation }),
    [variant, size, shape, orientation]
  );

  return (
    <ToggleGroupContext value={shared}>
      <ToggleGroupPrimitive.Root
        data-slot="toggle-group"
        orientation={orientation}
        className={toggleGroupStyles(shared).root({ className })}
        {...props}
      />
    </ToggleGroupContext>
  );
}

export type ToggleGroupItemProps = ComponentPropsWithRef<typeof ToggleGroupPrimitive.Item>;

export function ToggleGroupItem({ className, ...props }: ToggleGroupItemProps) {
  const shared = useToggleGroup('Item');

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={toggleGroupStyles(shared).item({ className })}
      {...props}
    />
  );
}
