import type { SizeOption, ToneOption } from '@vp/design-tokens';
import type { FillOption } from '../../types';

export type BadgeFill = Exclude<FillOption, 'ghost' | 'plain'> | 'scrim';
export type BadgeTone = ToneOption;
export type BadgeSize = Extract<SizeOption, 'sm' | 'md'>;
