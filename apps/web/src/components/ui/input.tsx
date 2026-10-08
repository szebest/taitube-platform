import type { ComponentProps } from 'react';

import { cn } from './cn';

export const FIELD =
  'tw:w-full tw:rounded-md tw:border tw:border-border tw:bg-surface tw:px-3 tw:font-sans tw:text-sm tw:text-fg tw:placeholder:text-fg-muted tw:focus-ring tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:aria-invalid:border-danger';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(FIELD, 'tw:h-9', className)} {...props} />;
}
