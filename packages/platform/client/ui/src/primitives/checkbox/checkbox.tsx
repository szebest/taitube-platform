import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { useFieldControl } from '../field';
import { Icon } from '../icon';
import { checkboxStyles } from './checkbox.variants';
import type { CheckboxSize } from './types';

export interface CheckboxProps extends ComponentPropsWithRef<typeof CheckboxPrimitive.Root> {
  size?: CheckboxSize;
}

/** `checked="indeterminate"` is a parent of a partly selected set. */
export function Checkbox({ size, className, ...props }: CheckboxProps) {
  const control = useFieldControl();
  const styles = checkboxStyles({ size });

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={styles.root({ className })}
      {...control}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className={styles.indicator()}>
        <Icon name="check" size="sm" strokeWidth={3} className={styles.check()} />
        <span className={styles.dash()} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
