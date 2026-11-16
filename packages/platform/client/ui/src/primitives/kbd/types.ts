import type { SizeOption } from '@vp/design-tokens';
import type { FillOption } from '../../types';

export type KbdFill = Extract<FillOption, 'outline' | 'soft'>;
export type KbdSize = Extract<SizeOption, 'sm' | 'md'>;
