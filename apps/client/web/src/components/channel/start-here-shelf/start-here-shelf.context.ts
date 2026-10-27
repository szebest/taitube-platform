import { createCompoundContext } from '@vp/ui';
import type { StartHereSource } from './types';

export const [StartHereShelfContext, useStartHereShelf] = createCompoundContext<{
  source: StartHereSource;
  /** The creator chose the order, so the cards carry their place in it. */
  numbered: boolean;
}>('StartHereShelf');
