import { createCompoundContext } from '@vp/ui';
import type { ShelfChevronSide, ShelfVariant } from './types';

export const [ShelfContext, useShelf] = createCompoundContext<{
  variant: ShelfVariant;
  titleId: string;
  atStart: boolean;
  atEnd: boolean;
  /** Scrolls the track by most of its visible width toward `side`. */
  scrollBy: (side: ShelfChevronSide) => void;
  setTrack: (track: HTMLUListElement | null) => void;
}>('Shelf');
