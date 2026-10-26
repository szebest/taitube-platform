import { SegmentedControlItem, SegmentedControlRoot } from './segmented-control';

export const SegmentedControl = { Root: SegmentedControlRoot, Item: SegmentedControlItem };
export type {
  SegmentedControlItemProps,
  SegmentedControlRootProps,
} from './segmented-control';
export { useSegmentedControl } from './segmented-control.context';
export { segmentedControlStyles } from './segmented-control.variants';
export type { SegmentedSize, SegmentedTone } from './types';
