import { Select as SelectPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { panelVariants } from '../../panel';
import { useFieldControl, useFieldSize } from '../field';
import { Icon } from '../icon';
import { selectStyles } from './select.variants';
import type { SelectFill, SelectShape, SelectSize } from './types';

const list = panelVariants({ kind: 'select' });

export interface SelectTriggerProps extends ComponentPropsWithRef<typeof SelectPrimitive.Trigger> {
  variant?: SelectFill;
  size?: SelectSize;
  shape?: SelectShape;
}

export function SelectTrigger({
  variant,
  size,
  shape,
  className,
  children,
  ...props
}: SelectTriggerProps) {
  const control = useFieldControl();
  const fieldSize = useFieldSize();
  const styles = selectStyles({ variant, size: size ?? fieldSize, shape });

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={styles.root({ className })}
      {...control}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <Icon name="chevron-down" size="sm" className={styles.chevron()} />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  sideOffset = 4,
  ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={sideOffset}
        className={list.content({ className })}
        {...props}
      >
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item data-slot="select-item" className={list.item({ className })} {...props}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className={selectStyles().indicator()}>
        <Icon name="check" size="sm" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({
  className,
  ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={list.label({ className })}
      {...props}
    />
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentPropsWithRef<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={list.separator({ className })}
      {...props}
    />
  );
}
