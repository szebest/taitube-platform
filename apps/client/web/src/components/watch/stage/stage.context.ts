import { createCompoundContext } from '@vp/ui';
import type { StageVariant } from './types';

export const [StageContext, useStage] = createCompoundContext<{
  variant: StageVariant;
  videoId: string | undefined;
  glowColors: readonly string[] | undefined;
  paused: boolean;
}>('Stage');
