import type { ToneOption } from '@vp/design-tokens';
import type { FillOption } from '../../types';

export type CalloutFill = Extract<FillOption, 'soft' | 'outline'>;
export type CalloutTone = Exclude<ToneOption, 'live'>;
