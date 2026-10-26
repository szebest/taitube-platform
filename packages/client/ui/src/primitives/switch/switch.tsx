import { Switch as SwitchPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';
import { useFieldControl } from '../field';
import { switchStyles } from './switch.variants';
import type { SwitchSize } from './types';

export interface SwitchProps extends ComponentPropsWithRef<typeof SwitchPrimitive.Root> {
  size?: SwitchSize;
}

/** Takes effect on toggle; a pending save is the caller's `disabled` and a `Spinner` beside it. */
export function Switch({ size, className, ...props }: SwitchProps) {
  const control = useFieldControl();
  const styles = switchStyles({ size });

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={styles.root({ className })}
      {...control}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className={styles.thumb()} />
    </SwitchPrimitive.Root>
  );
}
