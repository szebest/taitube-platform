import type { AvatarSize } from '@vp/ui';

export type ChartFrameSize = Extract<AvatarSize, 'sm' | 'md' | 'lg' | 'xl'>;
export type ChartFrameState = 'ready' | 'loading' | 'error' | 'empty';
export type ChartPalette = 'categorical' | 'sequential' | 'diverging';

export type ChartFrameStatus =
  | { state?: Exclude<ChartFrameState, 'error'>; onRetry?: never }
  | { state: Extract<ChartFrameState, 'error'>; onRetry: () => void };
