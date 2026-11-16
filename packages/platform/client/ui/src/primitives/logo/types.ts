import type { SizeOption, ToneOption } from '@vp/design-tokens';

export type LogoVariant = 'lockup' | 'mark' | 'wordmark';
export type LogoSize = Extract<SizeOption, 'sm' | 'md' | 'lg'>;
export type LogoTone = Extract<ToneOption, 'neutral' | 'accent'>;
