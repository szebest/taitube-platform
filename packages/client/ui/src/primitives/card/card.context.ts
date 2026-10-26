import { createCompoundContext } from '../../lib/create-compound-context';
import type { CardFill, CardSize } from './types';

export const [CardContext, useCard] = createCompoundContext<{ variant: CardFill; size: CardSize }>(
  'Card'
);
