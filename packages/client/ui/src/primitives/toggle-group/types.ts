import type { ControlSize } from '@vp/design-tokens';
import type { FillOption, ShapeOption } from '../../types';

export type ToggleFill = Extract<FillOption, 'outline' | 'ghost' | 'soft'>;
export type ToggleSize = ControlSize;
export type ToggleShape = Extract<ShapeOption, 'text' | 'pill'>;
