import { createCompoundContext } from '@vp/ui';
import type { StatCardSize, StatCardState } from './types';

export type StatCardShared = { size: StatCardSize } & (
  | { state: Exclude<StatCardState, 'error'> }
  | { state: Extract<StatCardState, 'error'>; onRetry: () => void }
);

export const [StatCardContext, useStatCard] = createCompoundContext<StatCardShared>('StatCard');
