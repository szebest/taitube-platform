import { Slot } from 'radix-ui';
import { type ComponentPropsWithRef, useContext, useMemo } from 'react';
import { useFieldControl, useFieldSize } from '../field';
import { InputGroupContext, useInputGroup } from './input.context';
import { inputStyles } from './input.variants';
import type { InputFill, InputShape, InputSize } from './types';

export interface InputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  variant?: InputFill;
  size?: InputSize;
  shape?: InputShape;
}

/** One element over native props; inside an `InputGroup.Root` the group draws the box and `variant`, `size` and `shape` are ignored. */
export function Input({ variant, size, shape, className, ...props }: InputProps) {
  const control = useFieldControl();
  const fieldSize = useFieldSize();
  const styles = inputStyles({ variant, size: size ?? fieldSize, shape });
  const grouped = useContext(InputGroupContext) !== undefined;

  return (
    <input
      data-slot="input"
      className={grouped ? styles.input({ className }) : styles.root({ className })}
      {...control}
      {...props}
    />
  );
}

export interface InputGroupRootProps extends ComponentPropsWithRef<'div'> {
  variant?: InputFill;
  size?: InputSize;
  shape?: InputShape;
}

export function InputGroupRoot({
  variant = 'outline',
  size = 'md',
  shape = 'text',
  className,
  ...props
}: InputGroupRootProps) {
  const shared = useMemo(() => ({ variant, size, shape }), [variant, size, shape]);

  return (
    <InputGroupContext value={shared}>
      <div
        data-slot="input-group"
        className={inputStyles(shared).root({ className })}
        {...props}
      />
    </InputGroupContext>
  );
}

export interface InputGroupPartProps extends ComponentPropsWithRef<'div'> {
  asChild?: boolean;
}

export function InputGroupStart({ asChild = false, className, ...props }: InputGroupPartProps) {
  const shared = useInputGroup('Start');
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="input-group-start"
      className={inputStyles(shared).adornment({ className })}
      {...props}
    />
  );
}

export function InputGroupEnd({ asChild = false, className, ...props }: InputGroupPartProps) {
  const shared = useInputGroup('End');
  const Element = asChild ? Slot.Root : 'div';

  return (
    <Element
      data-slot="input-group-end"
      className={inputStyles(shared).adornment({ className })}
      {...props}
    />
  );
}
