import { createCompoundContext } from '@vp/ui';
import type { PickOfTheDayLayout } from './types';

export const [PickOfTheDayContext, usePickOfTheDay] = createCompoundContext<{
  layout: PickOfTheDayLayout | undefined;
  glowColor: string | undefined;
  kickerId: string;
}>('PickOfTheDay');
