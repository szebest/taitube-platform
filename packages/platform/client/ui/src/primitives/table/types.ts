import type { ControlSize } from '@kit/design-tokens';
import type { Align } from '../../types';

export type TableSize = Extract<ControlSize, 'sm' | 'md'>;
export type TableAlign = Align;
