import { createCompoundContext } from '@vp/ui';
import type { QueueLayout } from './types';

export const [QueueContext, useQueue] = createCompoundContext<{
  currentId: string;
  layout: QueueLayout | undefined;
  select: (id: string) => void;
  remove: (id: string) => void;
  reorder: (id: string, toIndex: number) => void;
  headingId: string;
}>('Queue');
