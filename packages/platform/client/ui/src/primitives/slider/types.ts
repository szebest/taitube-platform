import type { SizeOption, ToneOption } from '@vp/design-tokens';

export type SliderSize = Extract<SizeOption, 'sm' | 'md' | 'lg'>;
export type SliderTone = Extract<ToneOption, 'accent' | 'neutral'>;
