import { createCompoundContext } from '../../lib/create-compound-context';
import type { SegmentedSize, SegmentedTone } from './types';

export const [SegmentedControlContext, useSegmentedControl] = createCompoundContext<{
  tone: SegmentedTone;
  size: SegmentedSize;
}>('SegmentedControl');
