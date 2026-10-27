import { Slot, ToggleGroup as ToggleGroupPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { useSlidingIndicator } from '../../lib/sliding-indicator';
import { ChipGroupContext, useChipGroup } from './chip.context';
import { chipGroupStyles, chipIndicatorStyles, chipStyles } from './chip.variants';
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

/** One tab stop, arrows move; name it with `aria-label`. A single choice slides its pill between chips. */
export function ChipGroupRoot({
  size = 'sm',
  ref,
  className,
  children,
  ...props
}: ChipGroupRootProps) {
  const indicated = useSlidingIndicator('[data-state="on"]', ref);
  const single = props.type === 'single';

  return (
    <ChipGroupContext value={{ size }}>
      <ToggleGroupPrimitive.Root
        ref={single ? indicated : ref}
        data-slot="chip-group"
        className={chipGroupStyles({ className })}
        {...props}
      >
        {single && (
          <span
            aria-hidden="true"
            data-slot="chip-group-indicator"
            className={chipIndicatorStyles}
          />
        )}
        {children}
      </ToggleGroupPrimitive.Root>
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
