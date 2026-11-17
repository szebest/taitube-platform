import { Popover as PopoverPrimitive } from 'radix-ui';
import { PopoverArrow, PopoverContent } from './popover';

export const Popover = {
  Root: PopoverPrimitive.Root,
  Trigger: PopoverPrimitive.Trigger,
  Anchor: PopoverPrimitive.Anchor,
  Content: PopoverContent,
  Arrow: PopoverArrow,
  Close: PopoverPrimitive.Close,
};
export type { PopoverContentProps } from './popover';
export { popoverStyles } from './popover.variants';
export type { PopoverSize } from './types';
