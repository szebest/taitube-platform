import type { ToneOption } from '@vp/design-tokens';

export type ToastTone = Exclude<ToneOption, 'accent' | 'live'>;
