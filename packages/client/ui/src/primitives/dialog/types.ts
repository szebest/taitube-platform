import type { SizeOption } from '@vp/design-tokens';
import type { Side } from '../../types';

export type DialogSide = Extract<Side, 'inline-start' | 'inline-end'>;
export type DialogSize = Extract<SizeOption, 'sm' | 'md' | 'lg'>;
