import type { ControlSize } from '@vp/design-tokens';
import type { Align } from '../../types';

export type TableSize = Extract<ControlSize, 'sm' | 'md'>;
export type TableAlign = Align;
