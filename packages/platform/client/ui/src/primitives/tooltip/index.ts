import { Tooltip as TooltipPrimitive } from 'radix-ui';
import { TooltipContent, TooltipProvider } from './tooltip';

export const Tooltip = {
  Provider: TooltipProvider,
  Root: TooltipPrimitive.Root,
  Trigger: TooltipPrimitive.Trigger,
  Content: TooltipContent,
};
export type { TooltipContentProps } from './tooltip';
