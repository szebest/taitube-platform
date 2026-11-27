import { HoverCard as HoverCardPrimitive } from 'radix-ui';
import { HoverCardArrow, HoverCardContent, HoverCardRoot } from './hover-card';

export const HoverCard = {
  Root: HoverCardRoot,
  Trigger: HoverCardPrimitive.Trigger,
  Content: HoverCardContent,
  Arrow: HoverCardArrow,
};
export type { HoverCardContentProps } from './hover-card';
export { hoverCardStyles } from './hover-card.variants';
export type { HoverCardSize } from './types';
