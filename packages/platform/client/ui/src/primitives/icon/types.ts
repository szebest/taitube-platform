import type { ToneOption } from '@kit/design-tokens';

export type IconTone = 'inherit' | Extract<ToneOption, 'neutral' | 'accent' | 'danger'>;
