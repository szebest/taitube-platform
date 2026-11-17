import type { ControlSize, ToneOption } from '@kit/design-tokens';

export type MenuSize = Extract<ControlSize, 'sm' | 'md'>;
export type MenuTone = Extract<ToneOption, 'neutral' | 'danger'>;
