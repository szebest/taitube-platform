import type { ControlSize } from '@vp/design-tokens';
import type { FillOption, Orientation } from '../../types';

export type TabsFill = Extract<FillOption, 'ghost' | 'soft'>;
export type TabsSize = Extract<ControlSize, 'sm' | 'md'>;
export type TabsOrientation = Orientation;
