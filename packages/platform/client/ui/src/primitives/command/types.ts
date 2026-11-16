import type { ControlSize } from '@vp/design-tokens';

export type CommandVariant = 'inline' | 'palette';
export type CommandSize = Extract<ControlSize, 'sm' | 'md'>;
