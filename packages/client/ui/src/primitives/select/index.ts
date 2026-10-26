import { Select as SelectPrimitive } from 'radix-ui';
import { SelectContent, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from './select';

export const Select = {
  Root: SelectPrimitive.Root,
  Trigger: SelectTrigger,
  Value: SelectPrimitive.Value,
  Content: SelectContent,
  Group: SelectPrimitive.Group,
  Label: SelectLabel,
  Item: SelectItem,
  Separator: SelectSeparator,
};
export type { SelectTriggerProps } from './select';
export { selectStyles } from './select.variants';
export type { SelectFill, SelectShape, SelectSize } from './types';
