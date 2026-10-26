import type { ToneOption } from '@vp/design-tokens';

export type IconTone = 'inherit' | Extract<ToneOption, 'neutral' | 'accent' | 'danger'>;
