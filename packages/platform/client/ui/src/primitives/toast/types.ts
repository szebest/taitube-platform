import type { ToneOption } from '@kit/design-tokens';

export type ToastTone = Exclude<ToneOption, 'accent' | 'live'>;
