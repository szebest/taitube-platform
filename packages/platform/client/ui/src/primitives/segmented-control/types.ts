import type { ControlSize, ToneOption } from '@vp/design-tokens';

export type SegmentedTone = Extract<ToneOption, 'neutral' | 'accent'>;
export type SegmentedSize = ControlSize;
