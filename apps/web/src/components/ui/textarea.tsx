import type { ComponentProps } from 'react';

import { cn } from './cn';
import { FIELD } from './input';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(FIELD, 'tw:min-h-20 tw:py-2', className)} {...props} />;
}
