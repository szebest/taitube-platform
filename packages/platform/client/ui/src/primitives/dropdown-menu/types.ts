import type { ControlSize, ToneOption } from '@vp/design-tokens';

export type MenuSize = Extract<ControlSize, 'sm' | 'md'>;
export type MenuTone = Extract<ToneOption, 'neutral' | 'danger'>;
