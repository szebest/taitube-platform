import { createCompoundContext } from '@vp/ui';
import type { ChipBarValue } from './types';

export const [ChipBarContext, useChipBar] = createCompoundContext<{
  value: ChipBarValue;
  multiple: boolean;
  isSelected: (value: string) => boolean;
  select: (value: string) => void;
  focusValue: string | undefined;
  setFocusValue: (value: string) => void;
}>('ChipBar');
