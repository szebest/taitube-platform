import type { ReactElement } from 'react';
import { Button, type ButtonProps } from '../button';

/** A button that shows only its icon, so the type asks for the name assistive technology reads. */
export type IconButtonProps = ButtonProps & {
  'aria-label': string;
  children: ReactElement;
  shape?: never;
};

export function IconButton({ variant = 'ghost', ...props }: IconButtonProps) {
  return <Button data-slot="icon-button" variant={variant} {...props} shape="icon" />;
}
