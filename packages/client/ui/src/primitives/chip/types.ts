import type { ControlSize } from '@vp/design-tokens';
import type { FillOption } from '../../types';

export type ChipFill = Extract<FillOption, 'soft' | 'outline'>;
export type ChipSize = Extract<ControlSize, 'sm' | 'md'>;
