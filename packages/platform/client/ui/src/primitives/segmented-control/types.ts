import type { ControlSize, ToneOption } from '@kit/design-tokens';

export type SegmentedTone = Extract<ToneOption, 'neutral' | 'accent'>;
export type SegmentedSize = ControlSize;
