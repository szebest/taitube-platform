import type { ComponentProps } from 'react';

import type { VariantProps } from 'tailwind-variants';
import { controlVariants, useFieldControl } from './field';

export type InputProps = Omit<ComponentProps<'input'>, 'size'> &
  Pick<VariantProps<typeof controlVariants>, 'size'>;

export function Input({ size, className, ...props }: InputProps) {
  const field = useFieldControl();

  return (
    <input
      data-slot="input"
      className={controlVariants({ kind: 'input', size, className })}
      {...field}
      {...props}
    />
  );
}
