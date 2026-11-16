import type { ControlSize, ToneOption } from '@vp/design-tokens';
import type { FillOption, ShapeOption } from '../../types';

export type ButtonFill = Exclude<FillOption, 'plain'>;
export type ButtonTone = Extract<ToneOption, 'neutral' | 'accent' | 'danger'>;
export type ButtonSize = ControlSize;
export type ButtonShape = ShapeOption;
