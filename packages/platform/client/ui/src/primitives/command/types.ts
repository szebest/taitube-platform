import type { ControlSize } from '@kit/design-tokens';

export type CommandVariant = 'inline' | 'palette';
export type CommandSize = Extract<ControlSize, 'sm' | 'md'>;
