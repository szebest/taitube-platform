import type { SizeOption, ToneOption } from '@vp/design-tokens';

export type ProgressSize = Extract<SizeOption, 'sm' | 'md' | 'lg'>;
export type ProgressTone = Extract<ToneOption, 'accent' | 'neutral'>;
