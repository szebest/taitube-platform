import type { ComponentPropsWithRef } from 'react';
import { useFieldControl, useFieldSize } from '../field';
import { textareaStyles } from './textarea.variants';
import type { TextareaFill, TextareaSize } from './types';

const MIN_ROWS = { sm: 2, md: 3, lg: 5 } satisfies Record<TextareaSize, number>;

export interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  variant?: TextareaFill;
  size?: TextareaSize;
  /** Grows with its content up to a cap, then scrolls. */
  autoGrow?: boolean;
}

export function Textarea({
  variant,
  size: ownSize,
  autoGrow = false,
  className,
  ...props
}: TextareaProps) {
  const control = useFieldControl();
  const fieldSize = useFieldSize();
  const size = ownSize ?? fieldSize ?? 'md';

  return (
    <textarea
      data-slot="textarea"
      rows={MIN_ROWS[size]}
      className={textareaStyles({ variant, size, autoGrow, className })}
      {...control}
      {...props}
    />
  );
}
