import type { ComponentProps } from 'react';

import { controlVariants, useFieldControl } from './field';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  const field = useFieldControl();

  return (
    <textarea
      data-slot="textarea"
      className={controlVariants({ kind: 'textarea', className })}
      {...field}
      {...props}
    />
  );
}
