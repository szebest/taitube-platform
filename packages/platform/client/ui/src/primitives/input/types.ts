import type { ControlSize } from '@vp/design-tokens';
import type { FillOption, ShapeOption } from '../../types';

export type InputFill = Extract<FillOption, 'outline' | 'soft'>;
export type InputSize = ControlSize;
export type InputShape = Extract<ShapeOption, 'text' | 'pill'>;
