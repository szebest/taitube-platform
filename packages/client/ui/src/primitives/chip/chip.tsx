import { Slot, ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import { type ComponentPropsWithRef, useMemo } from 'react';
import { ChipGroupContext, useChipGroup } from './chip.context';
import { chipGroupStyles, chipStyles } from './chip.variants';
import type { ChipFill, ChipSize } from './types';

export interface ChipProps extends ComponentPropsWithRef<'button'> {
  variant?: ChipFill;
  size?: ChipSize;
  /** Styles its one child, a router link for one; the selected link takes `aria-current`. */
  asChild?: boolean;
}

/** A lone toggle: selection is the native `aria-pressed`. */
export function Chip({
  variant,
  size,
  asChild = false,
  type = 'button',
  className,
  ...props
}: ChipProps) {
  const Element = asChild ? Slot.Root : 'button';

  return (
    <Element
      data-slot="chip"
      type={asChild ? undefined : type}
      className={chipStyles({ variant, size, className })}
      {...props}
    />
  );
}

export type ChipGroupRootProps = ComponentPropsWithRef<typeof ToggleGroupPrimitive.Root> & {
  size?: ChipSize;
};

/** One tab stop, arrows move; name it with `aria-label`. */
export function ChipGroupRoot({ size = 'sm', className, ...props }: ChipGroupRootProps) {
  const shared = useMemo(() => ({ size }), [size]);

  return (
    <ChipGroupContext value={shared}>
      <ToggleGroupPrimitive.Root
        data-slot="chip-group"
        className={chipGroupStyles({ className })}
        {...props}
      />
    </ChipGroupContext>
  );
}

export type ChipGroupItemProps = ComponentPropsWithRef<typeof ToggleGroupPrimitive.Item>;

export function ChipGroupItem({ className, ...props }: ChipGroupItemProps) {
  const { size } = useChipGroup('Item');

  return (
    <ToggleGroupPrimitive.Item
      data-slot="chip-group-item"
      className={chipStyles({ size, className })}
      {...props}
    />
  );
}
