import { createCompoundContext } from '@kit/ui';
import type { EngagementBarLayout } from './types';

export const [EngagementBarContext, useEngagementBar] = createCompoundContext<{
  layout: EngagementBarLayout | undefined;
}>('EngagementBar');
