import { createCompoundContext } from '../../lib/create-compound-context';
import type { ChipSize } from './types';

export const [ChipGroupContext, useChipGroup] = createCompoundContext<{ size: ChipSize }>(
  'ChipGroup'
);
