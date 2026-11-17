import type { ControlSize } from '@kit/design-tokens';
import type { FillOption } from '../../types';

export type ChipFill = Extract<FillOption, 'soft' | 'outline'>;
export type ChipSize = Extract<ControlSize, 'sm' | 'md'>;
