import type { SizeOption, ToneOption } from '@kit/design-tokens';

export type AvatarSize = SizeOption;
export type AvatarShape = 'circle' | 'square';
export type AvatarTone = Extract<ToneOption, 'neutral' | 'live'>;
