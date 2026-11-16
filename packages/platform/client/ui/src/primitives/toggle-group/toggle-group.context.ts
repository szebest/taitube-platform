import { createCompoundContext } from '../../lib/create-compound-context';
import type { Orientation } from '../../types';
import type { ToggleFill, ToggleShape, ToggleSize } from './types';

export const [ToggleGroupContext, useToggleGroup] = createCompoundContext<{
  variant: ToggleFill;
  size: ToggleSize;
  shape: ToggleShape;
  orientation: Orientation;
}>('ToggleGroup');
