import { VisuallyHidden as VisuallyHiddenPrimitive } from 'radix-ui';
import type { ComponentPropsWithRef } from 'react';

export type VisuallyHiddenProps = ComponentPropsWithRef<typeof VisuallyHiddenPrimitive.Root>;

/** Text for assistive technology only: a name or a status the design leaves off the screen. */
export function VisuallyHidden(props: VisuallyHiddenProps) {
  return <VisuallyHiddenPrimitive.Root data-slot="visually-hidden" {...props} />;
}
