import { createCompoundContext } from '@kit/ui';
import type { OfflineStateSize, OfflineStateTone } from './types';

export const [OfflineStateContext, useOfflineState] = createCompoundContext<{
  size: OfflineStateSize;
  tone: OfflineStateTone;
  checking: boolean;
}>('OfflineState');
