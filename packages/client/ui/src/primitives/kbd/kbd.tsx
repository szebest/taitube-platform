import type { ComponentPropsWithRef } from 'react';
import { kbdStyles } from './kbd.variants';
import type { KbdFill, KbdSize } from './types';

export interface KbdProps extends ComponentPropsWithRef<'kbd'> {
  variant?: KbdFill;
  size?: KbdSize;
}

/** One key; a chord is several in a row, and the control it triggers names the shortcut in `aria-keyshortcuts`. */
export function Kbd({ variant, size, className, ...props }: KbdProps) {
  return <kbd data-slot="kbd" className={kbdStyles({ variant, size, className })} {...props} />;
}
