import type { ElevationOption, SizeOption } from '@vp/design-tokens';
import type { FillOption } from '../../types';

export type CardFill = Extract<FillOption, 'solid' | 'outline' | 'ghost'>;
export type CardSize = Extract<SizeOption, 'sm' | 'md'>;
export type CardElevation = ElevationOption;
